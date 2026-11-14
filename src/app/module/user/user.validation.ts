import { z } from "zod";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";

const email = z.string().trim().toLowerCase().pipe(z.email());
const text = z.string().trim().min(1);
const identity = { name: text, email };
const profileSchema = z.object({
	contactNumber: text.optional(),
	personalEmail: email.optional(),
});
const adminSchema = z.object({
	...identity,
	role: z.enum(["ADMIN", "SUPER_ADMIN"]),
	personalEmail: email,
});
const facultySchema = z.object({
	...identity,
	personalEmail: email,
	departmentId: z.uuid(),
	designation: text,
	maxCreditLoad: z.coerce.number().positive().max(999).default(12),
});
const studentSchema = z.object({
	...identity,
	universityId: text,
	programId: z.uuid(),
	batchId: z.uuid(),
	personalEmail: email.optional(),
	contactNumber: text.optional(),
});
const idSchema = z.object({ id: z.uuid() });
const statusSchema = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]) });
const importSchema = z.object({ type: z.enum(["student", "faculty"]) });
const querySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	searchTerm: text.optional(),
	role: z.enum(UserRole).optional(),
	status: z.enum(UserStatus).optional(),
	departmentId: z.uuid().optional(),
	programId: z.uuid().optional(),
	batchId: z.uuid().optional(),
});

export const userValidation = {
	profileSchema,
	adminSchema,
	facultySchema,
	studentSchema,
	idSchema,
	statusSchema,
	importSchema,
	querySchema,
};
