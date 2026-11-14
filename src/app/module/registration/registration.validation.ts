import { z } from "zod";
import {
	RegistrationStatus,
	RegistrationPaymentStatus,
} from "../../../generated/prisma/enums";
export const registrationValidation = {
	adminQuerySchema: z.object({
		semesterId: z.uuid(),
		batchId: z.uuid().optional(),
		status: z.enum(RegistrationStatus).optional(),
		paymentStatus: z.enum(RegistrationPaymentStatus).optional(),
		atRisk: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
		searchTerm: z.string().trim().optional(),
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		sortBy: z.enum(["createdAt", "paymentDeadline"]).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	}),
	adminStudentParamsSchema: z.object({ studentId: z.uuid() }),
	adminSectionParamsSchema: z.object({
		studentId: z.uuid(),
		sectionId: z.uuid(),
	}),
	semesterQuerySchema: z.object({ semesterId: z.uuid() }),
	manualAddSchema: z.object({
		reason: z.string().trim().min(1).max(1000),
		bypass: z
			.array(
				z.enum([
					"WINDOW",
					"CREDIT_LIMIT",
					"PREREQUISITE",
					"TIME_CLASH",
					"CAPACITY",
				]),
			)
			.default([]),
	}),
	manualRemoveSchema: z.object({ reason: z.string().trim().min(1).max(1000) }),
	catalogQuerySchema: z.object({
		page: z.coerce.number().int().min(1).default(1),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		sortBy: z.enum(["createdAt", "code", "title"]).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
		searchTerm: z.string().trim().optional(),
	}),
	idempotencyKeySchema: z.string().trim().min(1).max(200).optional(),
	switchSchema: z
		.object({ fromSectionId: z.uuid(), toSectionId: z.uuid() })
		.refine(
			(value) => value.fromSectionId !== value.toSectionId,
			"Choose a different target section",
		),
	sectionParamsSchema: z.object({ sectionId: z.uuid() }),
};
