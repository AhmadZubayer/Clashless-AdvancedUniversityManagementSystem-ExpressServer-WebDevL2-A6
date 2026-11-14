import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { notificationController } from "./notification.controller";
import { notificationValidation } from "./notification.validation";

export const notificationRoutes = Router();

notificationRoutes.get(
	"/me",
	auth(),
	validateQuery(notificationValidation.querySchema),
	notificationController.getMyNotifications,
);
notificationRoutes.patch(
	"/read-all",
	auth(),
	notificationController.markAllRead,
);
notificationRoutes.patch(
	"/:id/read",
	auth(),
	validateParams(notificationValidation.idSchema),
	notificationController.markOneRead,
);
