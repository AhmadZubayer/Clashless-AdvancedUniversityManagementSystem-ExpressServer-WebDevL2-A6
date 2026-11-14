import type { Prisma } from "../../../generated/prisma/client";

export type INotificationItem = Prisma.NotificationCreateManyInput;

export interface INotificationQuery {
	unread: boolean;
	page: number;
	limit: number;
}
