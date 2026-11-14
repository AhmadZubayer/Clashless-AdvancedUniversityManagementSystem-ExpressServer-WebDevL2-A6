import { z } from "zod";
import {
	PaymentProvider,
	PaymentStatus,
} from "../../../generated/prisma/enums";
import { moneySchema } from "../../utils/decimalSchema";
import { offsetDateSchema } from "../../utils/offsetDateSchema";

const createPaymentSchema = z.object({
	amount: moneySchema,
	provider: z.enum(PaymentProvider).optional(),
});

const getPaymentParamsSchema = z.object({
	id: z.uuid("A valid payment ID is required"),
});

const adminQuerySchema = z.object({
	status: z.enum(PaymentStatus).optional(),
	from: offsetDateSchema.optional(),
	to: offsetDateSchema.optional(),
	batchId: z.uuid().optional(),
	searchTerm: z.string().trim().min(1).optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	sortBy: z.enum(["createdAt", "amount"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const paymentValidation = {
	createPaymentSchema,
	getPaymentParamsSchema,
	adminQuerySchema,
};
