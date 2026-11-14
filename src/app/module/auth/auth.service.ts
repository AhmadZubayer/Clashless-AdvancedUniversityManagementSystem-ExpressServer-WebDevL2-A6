import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider } from "../../../generated/prisma/enums";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { redisClient, redisKey } from "../../lib/redis";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import { sendEmail } from "../../utils/sendEmail";
import type {
	IChangePasswordPayload,
	IActivationPayload,
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,

	IResetPasswordPayload,

} from "./auth.interface";

const OTP_EXPIRATION_SECONDS = 5 * 60;

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const checkOtpSendLimit = async (email: string) => {
	const count = await redisClient.eval(`local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return count`, { keys: [redisKey(`otp-send-count:${email}`)], arguments: [] });
	if (Number(count) > 3) throw new AppError(httpStatus.TOO_MANY_REQUESTS, "Too many OTP requests", { code: "RATE_LIMITED" });
};

const requestActivationOtp = async ({ email }: IForgotPasswordPayload) => {
	await checkOtpSendLimit(email);
	const user = await prisma.user.findFirst({ where: { email, role: UserRole.STUDENT, emailVerified: false, status: UserStatus.ACTIVE, isDeleted: false } });
	if (!user) return;
	const otp = generateOtp();
	await redisClient.set(redisKey(`activation-otp:${email}`), JSON.stringify({ otp, attempts: 0 }), { expiration: { type: "EX", value: 600 } });
	try {
		await sendEmail({ to: email, subject: "Activate your account", templateName: "registration-otp", templateData: { name: user.name, email, otp, expirationMinutes: 10 } });
	} catch { logger.error({ userId: user.id }, "Activation email failed"); }
};

const activateUser = async ({ email, otp, password }: IActivationPayload) => {
	const verified = await redisClient.eval(`local value = redis.call('GET', KEYS[1]); if not value then return 0 end; local item = cjson.decode(value); if item.otp == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end; item.attempts = item.attempts + 1; if item.attempts >= 5 then redis.call('DEL', KEYS[1]) else redis.call('SET', KEYS[1], cjson.encode(item), 'KEEPTTL') end; return 0`, { keys: [redisKey(`activation-otp:${email}`)], arguments: [otp] });
	if (Number(verified) !== 1) throw new AppError(httpStatus.BAD_REQUEST, "The OTP is wrong or has expired", { code: "INVALID_OTP" });
	const hash = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));
	const user = await prisma.$transaction(async (tx) => {
		const updated = await tx.user.updateMany({ where: { email, role: UserRole.STUDENT, emailVerified: false, status: UserStatus.ACTIVE, isDeleted: false }, data: { password: hash, emailVerified: true } });
		if (updated.count !== 1) throw new AppError(httpStatus.BAD_REQUEST, "The OTP is wrong or has expired", { code: "INVALID_OTP" });
		return tx.user.findUniqueOrThrow({ where: { email }, omit: { password: true } });
	});
	try { await sendEmail({ to: email, subject: `Welcome to ${config.app_name}`, templateName: "welcome", templateData: { name: user.name } }); } catch { logger.error({ userId: user.id }, "Welcome email failed"); }
	return { ...createAuthTokens(user), user };
};

const createAuthTokens = (user: {
	id: string;
	name: string;
	email: string;
	role: UserRole;
	tokenVersion: number;
}) => {
	const jwtPayload = {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		tokenVersion: user.tokenVersion,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions["expiresIn"],
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions["expiresIn"],
	);

	return {
		accessToken,
		refreshToken,
	};
};

const checkUserCanLogin = (user: {
	status: UserStatus;
	isDeleted: boolean;
}) => {
	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { email, password } = payload;

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	checkUserCanLogin(user);
	if (user.role === UserRole.STUDENT && !user.emailVerified) {
		throw new AppError(httpStatus.FORBIDDEN, "Activate your account first", { code: "ACCOUNT_NOT_ACTIVATED" });
	}

	if (user.password === null) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const isPasswordMatched = await bcrypt.compare(password, user.password);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const { accessToken, refreshToken } = createAuthTokens(user);

	return {
		accessToken,
		refreshToken,
		needPasswordChange: user.needPasswordChange,
	};
};

const getMe = async (user: RequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.id,
		},
		omit: {
			password: true,
		},
		include: { admin: true, faculty: true, student: { include: { program: true, batch: true } } },
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || typeof verifiedRefreshToken.data !== "object" || typeof verifiedRefreshToken.data.id !== "string" || !Number.isInteger(verifiedRefreshToken.data.tokenVersion)) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.id },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE || user.tokenVersion !== data.tokenVersion) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	return createAuthTokens(user);
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;

	const isUserExist = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exist!");
	}

	checkUserCanLogin(isUserExist);

	if (isUserExist.password === null) {
		throw new AppError(httpStatus.BAD_REQUEST, "User Has Account With Google");
	}

	const otp = generateOtp();

	const key = redisKey(`forgot-password-otp:${isUserExist.email}`);

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: OTP_EXPIRATION_SECONDS,
		},
	});

	await sendEmail({
		to: isUserExist.email,
		subject: "Forgot Password",
		templateName: "forgot-password",
		templateData: {
			name: isUserExist.name,
			otp,
			expirationMinutes: OTP_EXPIRATION_SECONDS / 60,
		},
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExist = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exist!");
	}

	checkUserCanLogin(isUserExist);

	const key = redisKey(`forgot-password-otp:${isUserExist.email}`);

	const redisOtp = await redisClient.get(key);

	if (!redisOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP Expired. Please request a new one",
		);
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: {
			id: isUserExist.id,
		},
		data: {
			password: hashedNewPassword,
			needPasswordChange: false,
		},
	});

	await redisClient.del(key);

	await sendEmail({
		to: isUserExist.email,
		subject: "Password Changed",
		templateName: "reset-password-success",
		templateData: {
			name: isUserExist.name,
		},
	});
};

const changePassword = async (
	user: RequestUser,
	payload: IChangePasswordPayload,
) => {
	const isUserExist = await prisma.user.findUnique({
		where: {
			id: user.id,
		},
	});

	if (!isUserExist) {
		throw new AppError(httpStatus.NOT_FOUND, "User Does Not Exist!");
	}

	if (isUserExist.password === null) {
		throw new AppError(httpStatus.BAD_REQUEST, "User Has Account With Google");
	}

	const isPasswordMatched = await bcrypt.compare(
		payload.currentPassword,
		isUserExist.password,
	);

	if (!isPasswordMatched) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Current password is incorrect",
		);
	}

	const hashedNewPassword = await bcrypt.hash(
		payload.newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: {
			id: isUserExist.id,
		},
		data: {
			password: hashedNewPassword,
			needPasswordChange: false,
		},
	});
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		logger.warn({ err: error }, "Google ID Token Verification Failed");
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid Or Expired Google Id Token",
		);
	}

	if (!googleIdTokenPayload) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid Or Expired Google Id Token",
		);
	}

	if (!googleIdTokenPayload.email || !googleIdTokenPayload.email_verified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Email Not Found");
	}
	if (!googleIdTokenPayload.name) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google Email User Name Not Found",
		);
	}

	const email = googleIdTokenPayload.email.toLowerCase();

	// 1. already linked to this Google account
	let user = await prisma.user.findUnique({
		where: {
			googleId: googleIdTokenPayload.sub,
		},
	});

	if (!user) {
		const isUserExistWithEmail = await prisma.user.findUnique({
			where: {
				email,
			},
		});

		if (isUserExistWithEmail) {
			// 2. same email registered with a password: link the Google account
			// Google login is only for the default self-registered role.
			if (isUserExistWithEmail.role !== UserRole.STUDENT) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"This account must log in with email and password",
				);
			}

			checkUserCanLogin(isUserExistWithEmail);

			user = await prisma.user.update({
				where: {
					id: isUserExistWithEmail.id,
				},
				data: {
					googleId: googleIdTokenPayload.sub,
					emailVerified: true,
				},
			});
		} else {
			// 3. Google Register
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
				},
			});

			try {
				await sendEmail({
					to: user.email,
					subject: `Welcome To ${config.app_name}`,
					templateName: "welcome",
					templateData: {
						name: user.name,
					},
				});
			} catch (error) {
				logger.error(
					{ err: error, userId: user.id },
					"Failed to send welcome email",
				);
			}
		}
	}

	checkUserCanLogin(user);

	return createAuthTokens(user);
};

const logoutUser = (user: RequestUser) => prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } }, select: { id: true } });

export const authService = {
	requestActivationOtp,
	activateUser,
	logoutUser,


	loginUser,
	getMe,
	refreshToken,
	forgotPassword,
	resetPassword,
	changePassword,
	googleLogin,
};
