import { expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { registrationTotals } from "../../src/app/utils/registrationTotals";

const decimal = (value: string) => new Prisma.Decimal(value);

it.each([
	["123.99", "UNPAID"],
	["124", "MINIMUM_PAID"],
	["307.87", "FULLY_PAID"],
	["400", "FULLY_PAID"],
])(
	"F7 payment status at a rounded fee/minimum boundary: paid %s",
	(paid, expected) => {
		const result = registrationTotals({
			credits: [decimal("1.5")],
			perCreditFee: decimal("197.01"),
			semesterFee: decimal("12.35"),
			minPaymentPercent: 40,
			paidAmount: decimal(paid),
		});
		expect(result.totalCredits.toString()).toBe("1.5");
		expect(result.totalFee.toString()).toBe("307.87");
		expect(result.paymentStatus).toBe(expected);
	},
);
it("F7 fractional credit sums stay exact and the last drop removes the semester fee", () => {
	const input = {
		perCreditFee: decimal("10000"),
		semesterFee: decimal("12.35"),
		minPaymentPercent: 40,
		paidAmount: decimal("1205"),
	};
	const selected = registrationTotals({
		...input,
		credits: [decimal("0.1"), decimal("0.2")],
	});
	expect(selected.totalCredits.toString()).toBe("0.3");
	expect(selected.totalFee.toString()).toBe("3012.35");
	expect(selected.paymentStatus).toBe("MINIMUM_PAID");
	const dropped = registrationTotals({ ...input, credits: [] });
	expect(dropped.totalCredits.isZero()).toBe(true);
	expect(dropped.totalFee.isZero()).toBe(true);
	expect(dropped.paymentStatus).toBe("FULLY_PAID");
	expect(input.paidAmount.toString()).toBe("1205");
});
