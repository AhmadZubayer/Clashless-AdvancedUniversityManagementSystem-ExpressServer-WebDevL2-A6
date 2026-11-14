import config from "../../src/app/config";
import { jwtUtils } from "../../src/app/utils/jwt";
import type { User } from "../../src/generated/prisma/client";

export const tokenFor = (
	user: Pick<User, "id" | "name" | "email" | "role" | "tokenVersion">,
) =>
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
	);
