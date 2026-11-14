import { Prisma } from "../../generated/prisma/client";
import { LetterGrade } from "../../generated/prisma/enums";

export const gradePoints: Record<Exclude<LetterGrade, "W">, Prisma.Decimal> = {
	A: new Prisma.Decimal("4.00"),
	A_MINUS: new Prisma.Decimal("3.70"),
	B_PLUS: new Prisma.Decimal("3.30"),
	B: new Prisma.Decimal("3.00"),
	B_MINUS: new Prisma.Decimal("2.70"),
	C_PLUS: new Prisma.Decimal("2.30"),
	C: new Prisma.Decimal("2.00"),
	C_MINUS: new Prisma.Decimal("1.70"),
	D_PLUS: new Prisma.Decimal("1.30"),
	D: new Prisma.Decimal("1.00"),
	F: new Prisma.Decimal("0.00"),
};

export const getGradePoint = (grade: LetterGrade) =>
	grade === LetterGrade.W ? null : gradePoints[grade];

export interface ICourseAttempt {
	courseId: string;
	grade: LetterGrade;
	gradePoint: Prisma.Decimal;
	credits: Prisma.Decimal;
}
export function calculateAcademicStanding(attempts: readonly ICourseAttempt[]) {
	const best = new Map<string, ICourseAttempt>();
	for (const attempt of attempts) {
		if (attempt.grade === LetterGrade.W) continue;
		const previous = best.get(attempt.courseId);
		if (!previous || attempt.gradePoint.gt(previous.gradePoint))
			best.set(attempt.courseId, attempt);
	}
	let credits = new Prisma.Decimal(0);
	let weighted = new Prisma.Decimal(0);
	let earnedCredits = new Prisma.Decimal(0);
	for (const attempt of best.values()) {
		credits = credits.plus(attempt.credits);
		weighted = weighted.plus(attempt.gradePoint.times(attempt.credits));
		if (attempt.grade !== LetterGrade.F)
			earnedCredits = earnedCredits.plus(attempt.credits);
	}
	return {
		cgpa: credits.isZero()
			? new Prisma.Decimal(0)
			: weighted.div(credits).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
		earnedCredits,
	};
}
