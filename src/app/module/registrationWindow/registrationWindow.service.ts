import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import type {
	ICreateRegistrationWindow,
	IUpdateRegistrationWindow,
	IRegistrationWindowQuery,
} from "./registrationWindow.interface";

const getEligibleSemester = async (
	tx: Prisma.TransactionClient,
	id: string,
) => {
	const semester = await tx.semester.findUnique({ where: { id } });
	if (!semester) throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	if (semester.phase !== "PLANNING" && semester.phase !== "REGISTRATION")
		throw new AppError(
			httpStatus.CONFLICT,
			"Registration windows require PLANNING or REGISTRATION",
			{ code: "PHASE_NOT_ALLOWED" },
		);
	return semester;
};
const createRegistrationWindowIntoDB = (payload: ICreateRegistrationWindow) =>
	prisma.$transaction(
		async (tx) => {
			await getEligibleSemester(tx, payload.semesterId);
			if (
				!(await tx.batch.findUnique({
					where: { id: payload.batchId },
					select: { id: true },
				}))
			)
				throw new AppError(httpStatus.NOT_FOUND, "Batch not found");
			if (
				await tx.registrationWindow.findUnique({
					where: {
						unique_batch_window: {
							semesterId: payload.semesterId,
							batchId: payload.batchId,
						},
					},
				})
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"This batch already has a registration window for the semester",
				);
			return tx.registrationWindow.create({ data: payload });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

const getAllRegistrationWindowsFromDB = async (
	actor: RequestUser,
	query: IRegistrationWindowQuery,
) => {
	if (
		!(await prisma.semester.findUnique({
			where: { id: query.semesterId },
			select: { id: true },
		}))
	)
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found");
	let batchId: string | undefined;
	if (actor.role === UserRole.STUDENT) {
		const student = await prisma.student.findUnique({
			where: { userId: actor.id },
			select: { batchId: true },
		});
		if (!student)
			throw new AppError(httpStatus.NOT_FOUND, "Student profile not found");
		batchId = student.batchId;
	}
	const where: Prisma.RegistrationWindowWhereInput = {
		semesterId: query.semesterId,
		...(batchId ? { batchId } : {}),
		...(query.searchTerm
			? { batch: { code: { contains: query.searchTerm, mode: "insensitive" } } }
			: {}),
	};
	const [rows, total] = await prisma.$transaction([
		prisma.registrationWindow.findMany({
			where,
			take: query.limit,
			skip: (query.page - 1) * query.limit,
			orderBy: { [query.sortBy]: query.sortOrder },
			include: { batch: true },
		}),
		prisma.registrationWindow.count({ where }),
	]);
	const serverTime = new Date().toISOString();
	return {
		data: rows.map((row) => ({ ...row, serverTime })),
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};

const updateRegistrationWindowIntoDB = (
	actor: RequestUser,
	id: string,
	payload: IUpdateRegistrationWindow,
) =>
	prisma.$transaction(
		async (tx) => {
			const current = await tx.registrationWindow.findUnique({ where: { id } });
			if (!current)
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Registration window not found",
				);
			const now = new Date();
			if (now >= current.endsAt)
				throw new AppError(
					httpStatus.CONFLICT,
					"An ended registration window cannot change",
				);
			const running = now >= current.startsAt;
			if (running) {
				if (
					payload.startsAt !== undefined ||
					payload.semesterId !== undefined ||
					payload.batchId !== undefined ||
					!payload.endsAt ||
					payload.endsAt <= current.endsAt
				)
					throw new AppError(
						httpStatus.CONFLICT,
						"A running window can only have its end extended",
					);
				if (!payload.reason)
					throw new AppError(
						httpStatus.BAD_REQUEST,
						"A reason is required to extend a running window",
					);
			}
			const merged = {
				semesterId: payload.semesterId ?? current.semesterId,
				batchId: payload.batchId ?? current.batchId,
				startsAt: payload.startsAt ?? current.startsAt,
				endsAt: payload.endsAt ?? current.endsAt,
			};
			if (merged.endsAt <= merged.startsAt)
				throw new AppError(httpStatus.BAD_REQUEST, "End must be after start");
			const semester = await getEligibleSemester(tx, merged.semesterId);
			if (
				!(await tx.batch.findUnique({
					where: { id: merged.batchId },
					select: { id: true },
				}))
			)
				throw new AppError(httpStatus.NOT_FOUND, "Batch not found");
			if (
				await tx.registrationWindow.findFirst({
					where: {
						semesterId: merged.semesterId,
						batchId: merged.batchId,
						id: { not: id },
					},
					select: { id: true },
				})
			)
				throw new AppError(
					httpStatus.CONFLICT,
					"This batch already has a registration window for the semester",
				);
			const changed = await tx.registrationWindow.updateMany({
				where: {
					id,
					startsAt: current.startsAt,
					endsAt: current.endsAt,
					semesterId: current.semesterId,
					batchId: current.batchId,
				},
				data: merged,
			});
			if (changed.count !== 1)
				throw new AppError(httpStatus.CONFLICT, "Window changed; please retry");
			if (
				merged.endsAt.getTime() !== current.endsAt.getTime() ||
				merged.semesterId !== current.semesterId ||
				merged.batchId !== current.batchId
			) {
				const paymentDeadline = new Date(
					merged.endsAt.getTime() + semester.paymentDeadlineDays * 86400000,
				);
				if (!Number.isFinite(paymentDeadline.getTime()))
					throw new AppError(
						httpStatus.BAD_REQUEST,
						"Payment deadline exceeds supported date range",
					);
				await tx.semesterRegistration.updateMany({
					where: {
						semesterId: merged.semesterId,
						student: { batchId: merged.batchId },
					},
					data: { paymentDeadline },
				});
			}
			if (running)
				await createAuditLogIntoDB(tx, {
					actorId: actor.id,
					action: "REGISTRATION_WINDOW_EXTENDED",
					entity: "RegistrationWindow",
					entityId: id,
					reason: payload.reason,
					before: { endsAt: current.endsAt.toISOString() },
					after: { endsAt: merged.endsAt.toISOString() },
				});
			return tx.registrationWindow.findUniqueOrThrow({ where: { id } });
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

const deleteRegistrationWindowFromDB = (id: string) =>
	prisma.$transaction(
		async (tx) => {
			const window = await tx.registrationWindow.findUnique({ where: { id } });
			if (!window)
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Registration window not found",
				);
			if (new Date() >= window.startsAt)
				throw new AppError(
					httpStatus.CONFLICT,
					"A registration window can only be deleted before it starts",
				);
			const deleted = await tx.registrationWindow.deleteMany({
				where: { id, startsAt: window.startsAt, endsAt: window.endsAt },
			});
			if (deleted.count !== 1)
				throw new AppError(httpStatus.CONFLICT, "Window changed; please retry");
			return window;
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

export const registrationWindowService = {
	createRegistrationWindowIntoDB,
	getAllRegistrationWindowsFromDB,
	updateRegistrationWindowIntoDB,
	deleteRegistrationWindowFromDB,
};
