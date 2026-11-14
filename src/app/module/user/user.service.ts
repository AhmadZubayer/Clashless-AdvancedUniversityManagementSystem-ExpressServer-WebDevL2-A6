import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import { Prisma as PrismaRuntime } from "../../../generated/prisma/client";
import type { Prisma } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/enums";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import config from "../../config";
import type { RequestUser } from "../../middleware/checkAuth";
import { generatePassword } from "../../utils/password";
import { sendEmail } from "../../utils/sendEmail";
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

export const userService = { updateProfileIntoDB, createAdminIntoDB, createFacultyIntoDB, createStudentIntoDB };
