// Signs access tokens for the first 1,000 students of batch 23-3 and finds the
// target section (CSC2211 section 1). Output: tests/load/tokens.json (git-ignored).
// Run with: npx tsx tests/load/makeTokens.ts
import { writeFileSync } from "node:fs";
import config from "../../src/app/config";
import { prisma } from "../../src/app/lib/prisma";
import { jwtUtils } from "../../src/app/utils/jwt";

async function main() {
	const semester = await prisma.semester.findFirst({
		where: { phase: "REGISTRATION" },
	});
	if (!semester)
		throw new Error(
			"No semester in REGISTRATION. Run: npm run db:seed:demo -- --registration-open",
		);
	const section = await prisma.section.findFirst({
		where: {
			sectionNo: 1,
			offering: { semesterId: semester.id, course: { code: "CSC2211" } },
		},
		select: { id: true, capacity: true, enrolledCount: true },
	});
	if (!section) throw new Error("CSC2211 section 1 was not found");
	const students = await prisma.student.findMany({
		where: { batch: { code: "23-3" }, isDeleted: false },
		orderBy: { universityId: "asc" },
		take: 1000,
		select: {
			user: {
				select: { id: true, name: true, email: true, role: true, tokenVersion: true },
			},
		},
	});
	const tokens = students.map(({ user }) =>
		jwtUtils.createToken(
			{
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				tokenVersion: user.tokenVersion,
			},
			config.jwt_access_secret,
			"1d",
		),
	);
	writeFileSync(
		new URL("./tokens.json", import.meta.url),
		JSON.stringify({ sectionId: section.id, tokens }),
	);
	console.log(
		`Wrote ${tokens.length} tokens; section ${section.id} has ${section.enrolledCount}/${section.capacity} seats taken.`,
	);
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
