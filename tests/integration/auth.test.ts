import express from "express";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import config from "../../src/app/config";
import { prisma } from "../../src/app/lib/prisma";
import { auth } from "../../src/app/middleware/checkAuth";
import { globalErrorHandler } from "../../src/app/middleware/globalErrorHandler";
import type { User } from "../../src/generated/prisma/client";
import { createAdmin, createFaculty, createStudent } from "../helpers/factory";
import { tokenFor } from "../helpers/auth";
import { externalMocks, lastOtpFor } from "../helpers/mocks";

const password = "TestOnly@123";
const newPassword = "ChangedTest@456";
let hash: string;
beforeAll(async () => {
	hash = await bcrypt.hash(password, 4);
});

async function passwordUser(
	options: {
		student?: boolean;
		activated?: boolean;
		blocked?: boolean;
		needsChange?: boolean;
	} = {},
) {
	const user = options.student ? await createStudent() : await createAdmin();
	return prisma.user.update({
		where: { id: user.id },
		data: {
			password: hash,
			emailVerified: options.activated ?? true,
			status: options.blocked ? "BLOCKED" : "ACTIVE",
			needPasswordChange: options.needsChange ?? false,
		},
	});
}
const login = (user: Pick<User, "email">, pass = password) =>
	request(app)
		.post("/api/auth/login")
		.send({ email: user.email, password: pass });
const requestOtp = (email: string) =>
	request(app).post("/api/auth/activate/request-otp").send({ email });
const activate = (email: string, otp: unknown) =>
	request(app).post("/api/auth/activate/verify").send({ email, otp, password });
const refresh = (token: string) =>
	request(app)
		.post("/api/auth/refresh-token")
		.set("Cookie", `refreshToken=${token}`);

// F3 introduces the department resource. This test-only route exercises the real
// auth guard at that exact path without implementing F3 ahead of its build order.
const guardApp = express();
guardApp.get("/api/departments", auth(), (_req, res) => {
	res.status(200).json({ success: true });
});
guardApp.use(globalErrorHandler);

it("T-AUTH-01 login sets two cookies and returns needPasswordChange", async () => {
	const user = await passwordUser({ needsChange: true });
	const response = await login({ email: ` ${user.email.toUpperCase()} ` });
	expect(response.status).toBe(200);
	expect(response.headers["set-cookie"]).toHaveLength(2);
	expect(response.body.data.needPasswordChange).toBe(true);
});

it("T-AUTH-02 wrong and unknown credentials have the same 401 message", async () => {
	const user = await passwordUser();
	const wrong = await login(user, "Wrong@123");
	const unknown = await login({ email: "unknown@uni.edu" });
	expect(wrong.status).toBe(401);
	expect(unknown.status).toBe(401);
	expect(wrong.body.message).toBe(unknown.body.message);
});

it("T-AUTH-03 unactivated students cannot log in", async () => {
	const user = await passwordUser({ student: true, activated: false });
	const response = await login(user);
	expect(response.status).toBe(403);
	expect(response.body.errorDetails.code).toBe("ACCOUNT_NOT_ACTIVATED");
});

it("T-AUTH-04 blocked accounts cannot log in or refresh", async () => {
	const user = await passwordUser();
	const session = await login(user);
	await prisma.user.update({
		where: { id: user.id },
		data: { status: "BLOCKED" },
	});
	expect((await login(user)).status).toBe(403);
	expect((await refresh(session.body.data.refreshToken)).status).toBe(401);
});

it("T-AUTH-05 activation does not reveal whether an email exists", async () => {
	const user = await passwordUser({ student: true, activated: false });
	const before = externalMocks.emails.length;
	const known = await requestOtp(user.email);
	const unknown = await requestOtp("absent@uni.edu");
	expect(known.status).toBe(200);
	expect(unknown.status).toBe(200);
	expect(known.body.message).toBe(unknown.body.message);
	expect(externalMocks.emails.length - before).toBe(1);
});

it("T-AUTH-06 a fourth OTP send within fifteen minutes is rate limited", async () => {
	const user = await passwordUser({ student: true, activated: false });
	for (let i = 0; i < 3; i++)
		expect((await requestOtp(user.email)).status).toBe(200);
	const response = await requestOtp(user.email);
	expect(response.status).toBe(429);
	expect(response.body.errorDetails.code).toBe("RATE_LIMITED");
});

it("T-AUTH-07 activate with captured OTP, set cookies, and log in", async () => {
	const user = await passwordUser({ student: true, activated: false });
	await requestOtp(user.email);
	const response = await activate(user.email, lastOtpFor(user.email));
	expect(response.status).toBe(200);
	expect(response.headers["set-cookie"]).toHaveLength(2);
	expect(response.body.data.user.password).toBeUndefined();
	expect(
		(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
			.emailVerified,
	).toBe(true);
	expect((await login(user)).status).toBe(200);
	expect(
		(await activate(user.email, lastOtpFor(user.email))).body.errorDetails.code,
	).toBe("INVALID_OTP");
});

it("T-AUTH-08 five wrong attempts delete the activation OTP", async () => {
	const user = await passwordUser({ student: true, activated: false });
	await requestOtp(user.email);
	const correct = lastOtpFor(user.email);
	for (let i = 0; i < 5; i++) {
		const response = await activate(user.email, "000000");
		expect(response.status).toBe(400);
		expect(response.body.errorDetails.code).toBe("INVALID_OTP");
	}
	expect((await activate(user.email, correct)).body.errorDetails.code).toBe(
		"INVALID_OTP",
	);
});

it("T-AUTH-09 Google links the identity of an existing student", async () => {
	const user = await passwordUser({ student: true, activated: false });
	externalMocks.googlePayload = {
		email: user.email,
		sub: `google-${user.id}`,
		name: user.name,
		email_verified: true,
	};
	const response = await request(app)
		.post("/api/auth/google")
		.send({ idToken: "mock-token" });
	expect(response.status).toBe(200);
	const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
	expect(saved.googleId).toBe(`google-${user.id}`);
	expect(saved.emailVerified).toBe(true);
});

it("T-AUTH-10 Google rejects outside-domain, unknown and faculty identities", async () => {
	const faculty = await createFaculty();
	const count = await prisma.user.count();
	for (const email of [
		"outside@example.org",
		`missing@${config.university_email_domain}`,
		faculty.email,
	]) {
		externalMocks.googlePayload = {
			email,
			sub: "disallowed",
			name: "Mock",
			email_verified: true,
		};
		expect(
			(
				await request(app)
					.post("/api/auth/google")
					.send({ idToken: "mock-token" })
			).status,
		).toBe(403);
	}
	expect(await prisma.user.count()).toBe(count);
});

it("T-AUTH-11 reset password with captured OTP and reject old refresh token", async () => {
	const user = await passwordUser();
	const session = await login(user);
	const known = await request(app)
		.post("/api/auth/forgot-password")
		.send({ email: user.email });
	const unknown = await request(app)
		.post("/api/auth/forgot-password")
		.send({ email: "absent-reset@uni.edu" });
	expect(known.status).toBe(200);
	expect(known.body.message).toBe(unknown.body.message);
	const otp = lastOtpFor(user.email);
	const response = await request(app)
		.post("/api/auth/reset-password")
		.send({ email: user.email, otp, newPassword });
	expect(response.status).toBe(200);
	expect((await login(user, newPassword)).status).toBe(200);
	expect((await refresh(session.body.data.refreshToken)).status).toBe(401);
	expect(
		(
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${session.body.data.accessToken}`)
		).status,
	).toBe(401);
	expect(
		(
			await request(app)
				.post("/api/auth/reset-password")
				.send({ email: user.email, otp, newPassword })
		).status,
	).toBe(400);
});

it("T-AUTH-12 first-login password change blocks protected resources", async () => {
	const user = await passwordUser({ needsChange: true });
	const response = await request(guardApp)
		.get("/api/departments")
		.set("Authorization", `Bearer ${tokenFor(user)}`);
	expect(response.status).toBe(403);
	expect(response.body.errorDetails.code).toBe("PASSWORD_CHANGE_REQUIRED");
	const me = await request(app)
		.get("/api/auth/me")
		.set("Authorization", `Bearer ${tokenFor(user)}`);
	expect(me.status).toBe(200);
	expect(me.body.data.admin).toBeTruthy();
	expect(me.body.data.password).toBeUndefined();
});

it("T-AUTH-13 change password issues a working fresh session", async () => {
	const user = await passwordUser({ needsChange: true });
	const old = tokenFor(user);
	const response = await request(app)
		.post("/api/auth/change-password")
		.set("Authorization", `Bearer ${old}`)
		.send({ currentPassword: password, newPassword });
	expect(response.status).toBe(200);
	expect(response.headers["set-cookie"]).toHaveLength(2);
	expect(
		(
			await request(guardApp)
				.get("/api/departments")
				.set("Authorization", `Bearer ${response.body.data.accessToken}`)
		).status,
	).toBe(200);
	expect(
		(
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${old}`)
		).status,
	).toBe(401);
});

it("T-AUTH-14 logout revokes old refresh and access tokens", async () => {
	const user = await passwordUser({ needsChange: true });
	const session = await login(user);
	const response = await request(app)
		.post("/api/auth/logout")
		.set("Authorization", `Bearer ${session.body.data.accessToken}`);
	expect(response.status).toBe(200);
	expect(response.headers["set-cookie"]).toHaveLength(2);
	expect((await refresh(session.body.data.refreshToken)).status).toBe(401);
	expect(
		(
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${session.body.data.accessToken}`)
		).status,
	).toBe(401);
});

it("T-AUTH-15 self-registration and self-verify routes are removed", async () => {
	expect((await request(app).post("/api/auth/register").send({})).status).toBe(
		404,
	);
	expect(
		(await request(app).post("/api/auth/verify-email").send({})).status,
	).toBe(404);
});
