import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { roomController } from "./room.controller";
import { roomValidation } from "./room.validation";
export const roomRoutes = Router();
export const adminRoomRoutes = Router();
roomRoutes.get(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FACULTY),
	validateQuery(roomValidation.querySchema),
	roomController.getAllRooms,
);
adminRoomRoutes.use(auth(UserRole.ADMIN, UserRole.SUPER_ADMIN));
adminRoomRoutes.post(
	"/",
	validateRequest(roomValidation.createSchema),
	roomController.createRoom,
);
adminRoomRoutes.patch(
	"/:id",
	validateParams(roomValidation.idSchema),
	validateRequest(roomValidation.updateSchema),
	roomController.updateRoom,
);
