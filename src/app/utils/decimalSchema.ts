import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";

export const decimalSchema = z
	.union([
		z.number().finite(),
		z
			.string()
			.trim()
			.regex(/^\d+(?:\.\d+)?$/),
	])
	.transform((value) => new Prisma.Decimal(value.toString()));
export const moneySchema = decimalSchema.refine(
	(value) =>
		value.gt(0) && value.lte("99999999.99") && value.decimalPlaces() <= 2,
	"Must be a positive amount with at most two decimal places",
);
