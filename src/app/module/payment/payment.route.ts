import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { paymentController } from "./payment.controller";
import { paymentValidation } from "./payment.validation";
import { validateParams } from "../../middleware/validateParams";

export const paymentRoutes = Router();

paymentRoutes.post(
    "/create",
    auth(UserRole.STUDENT),
    validateRequest(paymentValidation.createPaymentSchema),
    paymentController.createPayment
);

paymentRoutes.get(
    "/",
    auth(UserRole.STUDENT),
    paymentController.getMyPayments
);

paymentRoutes.get(
    "/:id",
    auth(UserRole.STUDENT),
    validateParams(paymentValidation.getPaymentParamsSchema),
    paymentController.getPaymentById
);
