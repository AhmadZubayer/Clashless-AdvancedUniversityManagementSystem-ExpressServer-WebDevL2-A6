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

const forgotPassword = async ({ email }: IForgotPasswordPayload) => {
 await checkOtpSendLimit(email);
 const user = await prisma.user.findUnique({ where: { email } });
 if (!user || !user.password || user.isDeleted || user.status !== UserStatus.ACTIVE) return;
 const otp = generateOtp();
 await redisClient.set(redisKey(`forgot-password-otp:${email}`), otp, { expiration: { type: "EX", value: OTP_EXPIRATION_SECONDS } });
 try { await sendEmail({ to: email, subject: "Forgot Password", templateName: "forgot-password", templateData: { name: user.name, otp, expirationMinutes: 5 } }); }
 catch { logger.error({ userId: user.id }, "Password reset email failed"); }
};

const resetPassword = async ({ email, otp, newPassword }: IResetPasswordPayload) => {
 const user = await prisma.user.findUnique({ where: { email } });
 const verified = await redisClient.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end; return 0`, { keys: [redisKey(`forgot-password-otp:${email}`)], arguments: [otp] });
 if (!user || !user.password || user.isDeleted || user.status !== UserStatus.ACTIVE || Number(verified) !== 1) throw new AppError(httpStatus.BAD_REQUEST, "The OTP is wrong or has expired", { code: "INVALID_OTP" });
 const hash = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));
 await prisma.$transaction(async (tx) => {
  const changed = await tx.user.updateMany({ where: { id: user.id, password: user.password, tokenVersion: user.tokenVersion, status: UserStatus.ACTIVE, isDeleted: false }, data: { password: hash, needPasswordChange: false, tokenVersion: { increment: 1 } } });
  if (changed.count !== 1) throw new AppError(httpStatus.CONFLICT, "Account changed; request a new OTP");
 });
 try { await sendEmail({ to: email, subject: "Password Changed", templateName: "reset-password-success", templateData: { name: user.name } }); }
 catch { logger.error({ userId: user.id }, "Password confirmation email failed"); }
};

const changePassword = async (identity: RequestUser, { currentPassword, newPassword }: IChangePasswordPayload) => {
 const user = await prisma.user.findUnique({ where: { id: identity.id } });
 if (!user || !user.password || !(await bcrypt.compare(currentPassword, user.password))) throw new AppError(httpStatus.UNAUTHORIZED, "Current password is incorrect");
 const hash = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));
 const updated = await prisma.$transaction(async (tx) => {
  const changed = await tx.user.updateMany({ where: { id: user.id, password: user.password, tokenVersion: user.tokenVersion, status: UserStatus.ACTIVE, isDeleted: false }, data: { password: hash, needPasswordChange: false, tokenVersion: { increment: 1 } } });
  if (changed.count !== 1) throw new AppError(httpStatus.CONFLICT, "Account changed; please log in again");
  return tx.user.findUniqueOrThrow({ where: { id: user.id }, omit: { password: true } });
 });
 return { ...createAuthTokens(updated), needPasswordChange: updated.needPasswordChange };
};
const googleLogin = async ({ idToken }: IGoogleLoginPayload) => {
 let payload: TokenPayload | undefined;
 try {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: config.google_client_id });
  payload = ticket.getPayload();
 } catch { throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google token"); }
 const email = payload?.email?.trim().toLowerCase();
 if (!email || !payload?.email_verified || !payload.sub || !email.endsWith(`@${config.university_email_domain.toLowerCase()}`)) throw new AppError(httpStatus.FORBIDDEN, "Use an existing university student account");
 const user = await prisma.$transaction(async (tx) => {
  const existing = await tx.user.findUnique({ where: { email } });
  if (!existing || existing.role !== UserRole.STUDENT) throw new AppError(httpStatus.FORBIDDEN, "Google sign-in is only for existing students; staff must use a password");
  checkUserCanLogin(existing);
  if (existing.googleId && existing.googleId !== payload.sub) throw new AppError(httpStatus.FORBIDDEN, "Google identity does not match");
  return tx.user.update({ where: { id: existing.id }, data: { googleId: payload.sub, authProvider: AuthProvider.GOOGLE, emailVerified: true }, omit: { password: true } });
 });
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
