import bcrypt from "bcryptjs";
import { z } from "zod";
import config from "../src/app/config";
import { logger } from "../src/app/lib/logger";
import { prisma } from "../src/app/lib/prisma";
import { UserRole } from "../src/generated/prisma/enums";

async function seedAdmin() {
	const input = z
		.object({
			name: z.string().min(2),
			email: z.email(),
			password: z.string().min(8),
		})
		.parse({
			name: config.admin_name,
			email: config.admin_email,
			password: config.admin_password,
		});
	const email = input.email.toLowerCase();
	const password = await bcrypt.hash(
		input.password,
		Number(config.bcrypt_salt_rounds),
	);
	await prisma.$transaction(async (tx) => {
		const existing = await tx.user.findUnique({ where: { email } });
		if (existing && existing.role !== UserRole.SUPER_ADMIN)
			throw new Error("Admin email belongs to another role");
		const user =
			existing ??
			(await tx.user.create({
				data: {
					name: input.name,
					email,
					password,
					role: UserRole.SUPER_ADMIN,
					emailVerified: true,
					needPasswordChange: true,
				},
			}));
		await tx.admin.upsert({
			where: { userId: user.id },
			update: {},
			create: { userId: user.id, name: user.name, email, personalEmail: email },
		});
	});
	logger.info("Super admin and profile are ready");
}

seedAdmin()
	.catch(() => {
		logger.error("Super admin seed failed");
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
