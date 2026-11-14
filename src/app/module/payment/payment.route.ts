import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import { validateRequest } from "../../middleware/validateRequest";
import { paymentController } from "./payment.controller";
import { paymentValidation } from "./payment.validation";

export const paymentRoutes = Router();
export const adminPaymentRoutes = Router();

adminPaymentRoutes.get(
	"/",
	auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateQuery(paymentValidation.adminQuerySchema),
	paymentController.getAllPayments,
);

paymentRoutes.post(
	"/create",
	auth(UserRole.STUDENT),
	validateRequest(paymentValidation.createPaymentSchema),
	paymentController.createPayment,
);

paymentRoutes.get(
	"/me",
	auth(UserRole.STUDENT),
	paymentController.getMyPayments,
);

paymentRoutes.get(
	"/:id/receipt",
	auth(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateParams(paymentValidation.getPaymentParamsSchema),
	paymentController.getReceipt,
);

paymentRoutes.get(
	"/:id",
	auth(UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN),
	validateParams(paymentValidation.getPaymentParamsSchema),
	paymentController.getPaymentById,
);
