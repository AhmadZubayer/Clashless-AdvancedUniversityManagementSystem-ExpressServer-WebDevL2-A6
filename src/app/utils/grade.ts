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
