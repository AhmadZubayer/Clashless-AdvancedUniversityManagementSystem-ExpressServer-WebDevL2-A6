import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Prisma as PrismaRuntime } from "../../../generated/prisma/client";
import type { Prisma } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/enums";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import config from "../../config";
import type { RequestUser } from "../../middleware/checkAuth";
import { generatePassword } from "../../utils/password";
import { sendEmail } from "../../utils/sendEmail";
import { parseCsv } from "../../utils/csv";
import { queueAccountEmail } from "../../jobs/accountEmail";
import { userValidation } from "./user.validation";
import { createAuditLogIntoDB } from "../auditLog/auditLog.service";
import { AppError } from "../../utils/AppError";
import { deleteFromCloudinary, uploadToCloudinary } from "../../utils/uploadToCloudinary";
import type { IUpdateProfile, ICreateAdmin, ICreateFaculty, ICreateStudent } from "./user.interface";

const emailCreatedAccount = async (user: { id: string; name: string; email: string }, to: string, password?: string) => {
	try { await sendEmail({ to, subject: password ? `Welcome to ${config.app_name}` : `Activate your ${config.app_name} account`, templateName: password ? "staff-welcome" : "student-invite", templateData: { name: user.name, email: user.email, ...(password ? { password } : {}) } }); }
	catch { logger.error({ userId: user.id }, "New account email failed"); }
};

const ensureUnusedEmail = async (tx: Prisma.TransactionClient, email: string) => {
	if (await tx.user.findUnique({ where: { email }, select: { id: true } })) throw new AppError(httpStatus.CONFLICT, "Email is already in use");
};

const createAdminIntoDB = async (actor: RequestUser, payload: ICreateAdmin) => {
	if (payload.role === UserRole.SUPER_ADMIN && actor.role !== UserRole.SUPER_ADMIN) throw new AppError(httpStatus.FORBIDDEN, "Only a Super Admin may create a Super Admin");
	const password = generatePassword();
	const hash = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));
	const user = await prisma.$transaction(async (tx) => {
		await ensureUnusedEmail(tx, payload.email);
		const created = await tx.user.create({ data: { name: payload.name, email: payload.email, password: hash, role: payload.role, needPasswordChange: true, emailVerified: true, admin: { create: { name: payload.name, email: payload.email, personalEmail: payload.personalEmail } } }, omit: { password: true }, include: { admin: true } });
		await createAuditLogIntoDB(tx, { actorId: actor.id, action: "USER_CREATED", entity: "User", entityId: created.id, after: { role: created.role, email: created.email } });
		return created;
	});
	await emailCreatedAccount(user, payload.personalEmail, password);
	return user;
};

const createFacultyIntoDB = async (actor: RequestUser, payload: ICreateFaculty) => {
	const password = generatePassword();
	const hash = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));
	const user = await prisma.$transaction(async (tx) => {
		await ensureUnusedEmail(tx, payload.email);
		if (!await tx.department.findFirst({ where: { id: payload.departmentId, isDeleted: false } })) throw new AppError(httpStatus.NOT_FOUND, "Department not found");
		const created = await tx.user.create({ data: { name: payload.name, email: payload.email, password: hash, role: UserRole.FACULTY, needPasswordChange: true, emailVerified: true, faculty: { create: { ...payload, maxCreditLoad: new PrismaRuntime.Decimal(payload.maxCreditLoad.toString()) } } }, omit: { password: true }, include: { faculty: true } });
		await createAuditLogIntoDB(tx, { actorId: actor.id, action: "USER_CREATED", entity: "User", entityId: created.id, after: { role: created.role, email: created.email } });
		return created;
	});
	await emailCreatedAccount(user, payload.personalEmail, password);
	return user;
};

const createStudentIntoDB = async (actor: RequestUser, payload: ICreateStudent) => {
	const user = await prisma.$transaction(async (tx) => {
		await ensureUnusedEmail(tx, payload.email);
		if (await tx.student.findUnique({ where: { universityId: payload.universityId } })) throw new AppError(httpStatus.CONFLICT, "University ID is already in use");
		if (!await tx.program.findUnique({ where: { id: payload.programId } })) throw new AppError(httpStatus.NOT_FOUND, "Program not found");
		if (!await tx.batch.findUnique({ where: { id: payload.batchId } })) throw new AppError(httpStatus.NOT_FOUND, "Batch not found");
		const created = await tx.user.create({ data: { name: payload.name, email: payload.email, role: UserRole.STUDENT, password: null, emailVerified: false, student: { create: payload } }, omit: { password: true }, include: { student: true } });
		await createAuditLogIntoDB(tx, { actorId: actor.id, action: "USER_CREATED", entity: "User", entityId: created.id, after: { role: created.role, email: created.email } });
		return created;
	});
	await emailCreatedAccount(user, payload.email);
	return user;
};

interface IImportItem { row: number; userId: string; payload: ICreateStudent | ICreateFaculty; password?: string; hash?: string }
const importUsersIntoDB = async (actor: RequestUser, type: "student" | "faculty", csv: Buffer) => {
	const failed: { row: number; reason: string }[] = [];
	const prepared: IImportItem[] = [];
	const emails = new Set<string>(); const universityIds = new Set<string>();
	for (const row of parseCsv(csv.toString("utf8"))) {
		if (row.error) { failed.push({ row: row.row, reason: row.error }); continue; }
		const values = Object.fromEntries(Object.entries(row.values).filter(([, value]) => value.trim() !== ""));
		const result = (type === "student" ? userValidation.studentSchema : userValidation.facultySchema).safeParse(values);
		if (!result.success) { failed.push({ row: row.row, reason: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }); continue; }
		const payload = result.data;
		const universityId = "universityId" in payload ? payload.universityId : undefined;
		if (emails.has(payload.email) || (universityId && universityIds.has(universityId))) { failed.push({ row: row.row, reason: "Duplicate email or university ID in CSV" }); continue; }
		emails.add(payload.email); if (universityId) universityIds.add(universityId);
		prepared.push({ row: row.row, userId: randomUUID(), payload });
	}
	let created = 0;
	for (let offset = 0; offset < prepared.length; offset += 500) {
		const chunk = prepared.slice(offset, offset + 500);
		if (type === "faculty") for (const item of chunk) { item.password = generatePassword(); item.hash = await bcrypt.hash(item.password, Number(config.bcrypt_salt_rounds)); }
		let inserted: IImportItem[] = [];
		// Serializable retries re-read collisions if another import creates the same account.
		for (let attempt = 0; attempt < 4; attempt++) {
			try {
				const outcome = await prisma.$transaction(async (tx) => {
					const existing = await tx.user.findMany({ where: { email: { in: chunk.map((item) => item.payload.email) } }, select: { email: true } });
					const existingIds = type === "student" ? await tx.student.findMany({ where: { universityId: { in: chunk.map((item) => (item.payload as ICreateStudent).universityId) } }, select: { universityId: true } }) : [];
					const deptIds = type === "faculty" ? (await tx.department.findMany({ where: { id: { in: chunk.map((item) => (item.payload as ICreateFaculty).departmentId) }, isDeleted: false }, select: { id: true } })).map((row) => row.id) : [];
					const programIds = type === "student" ? (await tx.program.findMany({ where: { id: { in: chunk.map((item) => (item.payload as ICreateStudent).programId) } }, select: { id: true } })).map((row) => row.id) : [];
					const batchIds = type === "student" ? (await tx.batch.findMany({ where: { id: { in: chunk.map((item) => (item.payload as ICreateStudent).batchId) } }, select: { id: true } })).map((row) => row.id) : [];
					const accepted: IImportItem[] = []; const rejected: { row: number; reason: string }[] = [];
					for (const item of chunk) {
						const student = item.payload as ICreateStudent; const faculty = item.payload as ICreateFaculty;
						let reason: string | undefined;
						if (existing.some((row) => row.email === item.payload.email) || existingIds.some((row) => row.universityId === student.universityId)) reason = "Email or university ID already exists";
						else if (type === "student" && (!programIds.includes(student.programId) || !batchIds.includes(student.batchId))) reason = "Program or batch not found";
						else if (type === "faculty" && !deptIds.includes(faculty.departmentId)) reason = "Department not found";
						if (reason) rejected.push({ row: item.row, reason }); else accepted.push(item);
					}
					if (accepted.length) {
						await tx.user.createMany({ data: accepted.map((item) => ({ id: item.userId, name: item.payload.name, email: item.payload.email, password: item.hash ?? null, role: type === "student" ? UserRole.STUDENT : UserRole.FACULTY, emailVerified: type === "faculty", needPasswordChange: type === "faculty" })) });
						if (type === "student") await tx.student.createMany({ data: accepted.map((item) => ({ ...item.payload as ICreateStudent, userId: item.userId })) });
						else await tx.faculty.createMany({ data: accepted.map((item) => ({ ...item.payload as ICreateFaculty, userId: item.userId, maxCreditLoad: new PrismaRuntime.Decimal((item.payload as ICreateFaculty).maxCreditLoad.toString()) })) });
						await createAuditLogIntoDB(tx, { actorId: actor.id, action: "USERS_IMPORTED", entity: "User", entityId: actor.id, after: { userIds: accepted.map((item) => item.userId), type } });
					}
					return { accepted, rejected };
				}, { isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable, timeout: 30000 });
				inserted = outcome.accepted; failed.push(...outcome.rejected); break;
			} catch (error) {
				if (attempt < 3 && error instanceof PrismaRuntime.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
				throw error;
			}
		}
		created += inserted.length;
		for (const item of inserted) await queueAccountEmail({ to: "personalEmail" in item.payload && type === "faculty" ? item.payload.personalEmail! : item.payload.email, name: item.payload.name, email: item.payload.email, ...(item.password ? { password: item.password } : {}) }).catch(() => logger.error({ userId: item.userId }, "Account email could not be queued"));
	}
	return { created, failed: failed.sort((a, b) => a.row - b.row) };
};

const updateProfileIntoDB = async (userId: string, payload: IUpdateProfile, photo?: Buffer) => {
	const uploaded = photo ? await uploadToCloudinary(photo) : undefined;
	let oldImage: string | undefined;
	let user;
	try {
		user = await prisma.$transaction(async (tx) => {
			const current = await tx.user.findFirst({ where: { id: userId, isDeleted: false, status: "ACTIVE" } });
			if (!current) throw new AppError(httpStatus.UNAUTHORIZED, "Account is inactive");
			oldImage = current.imagePublicId;
			const data: Prisma.UserUpdateInput = uploaded ? { imageUrl: uploaded.url, imagePublicId: uploaded.publicId } : {};
			if (current.role === UserRole.STUDENT) data.student = { update: payload };
			else if (current.role === UserRole.FACULTY) data.faculty = { update: payload };
			else data.admin = { update: payload };
			return tx.user.update({ where: { id: userId }, data, omit: { password: true }, include: { admin: true, faculty: true, student: true } });
		});
	} catch (error) {
		if (uploaded) await deleteFromCloudinary(uploaded.publicId).catch(() => logger.error("Uploaded image cleanup failed"));
		throw error;
	}
	if (uploaded && oldImage && oldImage !== uploaded.publicId) await deleteFromCloudinary(oldImage).catch(() => logger.error("Previous profile image cleanup failed"));
	return user;
};

export const userService = { updateProfileIntoDB, createAdminIntoDB, createFacultyIntoDB, createStudentIntoDB, importUsersIntoDB };
