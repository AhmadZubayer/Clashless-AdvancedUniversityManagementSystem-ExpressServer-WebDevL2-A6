import type { Prisma } from "../../../generated/prisma/client";
import type { INotificationItem } from "./notification.interface";

export const createNotificationsIntoDB = (tx: Prisma.TransactionClient, items: INotificationItem[]) => tx.notification.createMany({ data: items });
export const notificationService = { createNotificationsIntoDB };
