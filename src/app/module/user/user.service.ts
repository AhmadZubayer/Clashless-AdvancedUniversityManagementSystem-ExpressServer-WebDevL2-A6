import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import { UserRole } from "../../../generated/prisma/enums";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { deleteFromCloudinary, uploadToCloudinary } from "../../utils/uploadToCloudinary";
import type { IUpdateProfile } from "./user.interface";

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

export const userService = { updateProfileIntoDB };
