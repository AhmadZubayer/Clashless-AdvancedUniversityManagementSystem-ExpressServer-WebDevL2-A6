import { Prisma } from "../../generated/prisma/client";

export function registrationTotals(input: {
	credits: Prisma.Decimal[];
	perCreditFee: Prisma.Decimal;
	semesterFee: Prisma.Decimal;
	paidAmount: Prisma.Decimal;
	minPaymentPercent: number;
}) {
	const totalCredits = input.credits.reduce(
		(sum, value) => sum.plus(value),
		new Prisma.Decimal(0),
	);
	const totalFee = totalCredits.isZero()
		? new Prisma.Decimal(0)
		: totalCredits
				.mul(input.perCreditFee)
				.plus(input.semesterFee)
				.toDecimalPlaces(2);
	const minimumPayment = totalFee.mul(input.minPaymentPercent).div(100).ceil();
	const paymentStatus = totalFee.isZero()
		? "UNPAID"
		: input.paidAmount.gte(totalFee)
			? "FULLY_PAID"
			: input.paidAmount.gte(minimumPayment)
				? "MINIMUM_PAID"
				: "UNPAID";
	return { totalCredits, totalFee, paymentStatus } as const;
}

export function minimumPaymentOf(totalFee: Prisma.Decimal, percent: number) {
	return totalFee.mul(percent).div(100).ceil();
}

export function paymentStatusOf(
	totalFee: Prisma.Decimal,
	paidAmount: Prisma.Decimal,
	minPaymentPercent: number,
) {
	if (totalFee.lte(0)) return "UNPAID" as const;
	if (paidAmount.gte(totalFee)) return "FULLY_PAID" as const;
	return paidAmount.gte(minimumPaymentOf(totalFee, minPaymentPercent))
		? ("MINIMUM_PAID" as const)
		: ("UNPAID" as const);
}
