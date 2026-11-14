import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	INotificationItem,
	INotificationQuery,
} from "./notification.interface";

export const createNotificationsIntoDB = (
	tx: Prisma.TransactionClient,
	items: INotificationItem[],
) => tx.notification.createMany({ data: items });

const getMyNotificationsFromDB = async (
	userId: string,
	query: INotificationQuery,
) => {
	const where: Prisma.NotificationWhereInput = {
		userId,
		...(query.unread ? { isRead: false } : {}),
	};
	const [data, total] = await Promise.all([
		prisma.notification.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
		}),
		prisma.notification.count({ where }),
	]);
	return {
		data,
		meta: {
			page: query.page,
			limit: query.limit,
			total,
			totalPages: Math.ceil(total / query.limit),
		},
	};
};

const markAllReadIntoDB = async (userId: string) => {
	const result = await prisma.notification.updateMany({
		where: { userId, isRead: false },
		data: { isRead: true },
	});
	return { updated: result.count };
};

const markOneReadIntoDB = async (userId: string, id: string) => {
	const result = await prisma.notification.updateMany({
		where: { id, userId },
		data: { isRead: true },
	});
	if (!result.count) throw new AppError(404, "Notification not found");
	return prisma.notification.findUniqueOrThrow({ where: { id } });
};

export const notificationService = {
	createNotificationsIntoDB,
	getMyNotificationsFromDB,
	markAllReadIntoDB,
	markOneReadIntoDB,
};
