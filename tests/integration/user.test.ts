import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import {
	createAcademicWorld,
	createAdmin,
	createFaculty,
	createStudent,
} from "../helpers/factory";
import { externalMocks } from "../helpers/mocks";

let superAdmin: Awaited<ReturnType<typeof createAdmin>>;
let admin: Awaited<ReturnType<typeof createAdmin>>;
beforeAll(async () => {
	superAdmin = await createAdmin("SUPER_ADMIN");
	admin = await createAdmin();
});
const asAdmin = () => `Bearer ${tokenFor(admin)}`;
const asSuper = () => `Bearer ${tokenFor(superAdmin)}`;

it("T-USER-01 Super Admin creates ADMIN and welcome password works", async () => {
	const email = "new-admin@uni.edu";
	const personalEmail = "personal-admin@example.org";
	const response = await request(app)
		.post("/api/admin/users/admins")
		.set("Authorization", asSuper())
		.send({ role: "ADMIN", name: "New Admin", email, personalEmail });
	expect(response.status).toBe(201);
	expect(response.body.data.password).toBeUndefined();
	const welcome = externalMocks.emails.findLast(
		(mail) => mail.to === personalEmail,
	);
	expect(welcome).toBeDefined();
	expect(welcome?.templateData.password).toHaveLength(12);
	const login = await request(app)
		.post("/api/auth/login")
		.send({ email, password: welcome?.templateData.password });
	expect(login.status).toBe(200);
	expect(login.body.data.needPasswordChange).toBe(true);
	expect(
		await prisma.auditLog.count({
			where: { entityId: response.body.data.id, action: "USER_CREATED" },
		}),
	).toBe(1);
});

it("T-USER-02 Admin cannot create SUPER_ADMIN", async () => {
	const response = await request(app)
		.post("/api/admin/users/admins")
		.set("Authorization", asAdmin())
		.send({
			role: "SUPER_ADMIN",
			name: "Disallowed",
			email: "disallowed@uni.edu",
			personalEmail: "disallowed@example.org",
		});
	expect(response.status).toBe(403);
});

it("T-USER-03 teacher creation requires an existing department", async () => {
	const response = await request(app)
		.post("/api/admin/users/faculties")
		.set("Authorization", asAdmin())
		.send({
			name: "Faculty",
			email: "faculty-unknown@uni.edu",
			personalEmail: "faculty-unknown@example.org",
			departmentId: randomUUID(),
			designation: "Lecturer",
		});
	expect(response.status).toBe(404);
	expect(
		await prisma.user.findUnique({
			where: { email: "faculty-unknown@uni.edu" },
		}),
	).toBeNull();
});

it("T-USER-04 create student then reject duplicate university ID", async () => {
	const world = await createAcademicWorld();
	const body = {
		name: "Student",
		email: "new-student@uni.edu",
		universityId: "2023-3-60-0001",
		programId: world.program.id,
		batchId: world.batch.id,
	};
	const response = await request(app)
		.post("/api/admin/users/students")
		.set("Authorization", asAdmin())
		.send(body);
	expect(response.status).toBe(201);
	expect(response.body.data.emailVerified).toBe(false);
	expect(response.body.data.password).toBeUndefined();
	const stored = await prisma.user.findUniqueOrThrow({
		where: { id: response.body.data.id },
	});
	expect(stored.password).toBeNull();
	const duplicate = await request(app)
		.post("/api/admin/users/students")
		.set("Authorization", asAdmin())
		.send({ ...body, email: "another-student@uni.edu" });
	expect(duplicate.status).toBe(409);
	expect(
		externalMocks.emails.some(
			(mail) =>
				mail.to === body.email && mail.templateData.email === body.email,
		),
	).toBe(true);
});

it("T-USER-05 CSV imports three good rows and reports duplicate and bad email", async () => {
	const world = await createAcademicWorld();
	const header = "name,email,universityId,programId,batchId";
	const rows = [1, 2, 3].map(
		(i) =>
			`"Student, ${i}",import${i}@uni.edu,2023-3-60-IMP${i},${world.program.id},${world.batch.id}`,
	);
	const csv = [
		header,
		...rows,
		rows[0],
		`Invalid,not-an-email,2023-3-60-BAD,${world.program.id},${world.batch.id}`,
	].join("\r\n");
	const response = await request(app)
		.post("/api/admin/users/import")
		.set("Authorization", asAdmin())
		.field("type", "student")
		.attach("file", Buffer.from(csv), "students.csv");
	expect(response.status).toBe(200);
	expect(response.body.data.created).toBe(3);
	expect(response.body.data.failed).toHaveLength(2);
	expect(
		response.body.data.failed.map((row: { row: number }) => row.row),
	).toEqual([5, 6]);
	expect(
		response.body.data.failed.every(
			(row: { reason: string }) => row.reason.length > 0,
		),
	).toBe(true);
	expect(
		await prisma.student.count({ where: { batchId: world.batch.id } }),
	).toBe(3);
	expect(
		externalMocks.emails.filter((mail) =>
			/^import[123]@uni.edu$/.test(mail.to),
		),
	).toHaveLength(3);
});

it("T-USER-06 batch filter and limit produce correct pagination", async () => {
	const world = await createAcademicWorld();
	for (let i = 0; i < 3; i++)
		await createStudent({ batch: world.batch, program: world.program });
	const response = await request(app)
		.get(`/api/admin/users?batchId=${world.batch.id}&limit=2`)
		.set("Authorization", asAdmin());
	expect(response.status).toBe(200);
	expect(response.body.data).toHaveLength(2);
	expect(response.body.meta).toEqual({
		page: 1,
		limit: 2,
		total: 3,
		totalPages: 2,
	});
	expect(
		response.body.data.every(
			(user: { student: { batchId: string }; password?: string }) =>
				user.student.batchId === world.batch.id && user.password === undefined,
		),
	).toBe(true);
	const detail = await request(app)
		.get(`/api/admin/users/${response.body.data[0].id}`)
		.set("Authorization", asAdmin());
	expect(detail.status).toBe(200);
	expect(detail.body.data.student.batch.id).toBe(world.batch.id);
});

it("T-USER-07 blocking a student immediately revokes the old token", async () => {
	const student = await createStudent();
	const token = tokenFor(student);
	const response = await request(app)
		.patch(`/api/admin/users/${student.id}/status`)
		.set("Authorization", asAdmin())
		.send({ status: "BLOCKED" });
	expect(response.status).toBe(200);
	expect(
		(
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${token}`)
		).status,
	).toBe(401);
	const unblocked = await request(app)
		.patch(`/api/admin/users/${student.id}/status`)
		.set("Authorization", asAdmin())
		.send({ status: "ACTIVE" });
	expect(unblocked.status).toBe(200);
	expect(
		(
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${token}`)
		).status,
	).toBe(401);
	expect(
		await prisma.auditLog.count({
			where: { entityId: student.id, action: "USER_STATUS_CHANGED" },
		}),
	).toBe(2);
});

it("T-USER-08 Admin cannot manage an Admin and Super Admin cannot target self", async () => {
	const other = await createAdmin();
	expect(
		(
			await request(app)
				.patch(`/api/admin/users/${other.id}/status`)
				.set("Authorization", asAdmin())
				.send({ status: "BLOCKED" })
		).status,
	).toBe(403);
	expect(
		(
			await request(app)
				.patch(`/api/admin/users/${superAdmin.id}/status`)
				.set("Authorization", asSuper())
				.send({ status: "BLOCKED" })
		).status,
	).toBe(403);
	expect(
		(
			await request(app)
				.delete(`/api/admin/users/${other.id}`)
				.set("Authorization", asAdmin())
		).status,
	).toBe(403);
	expect(
		(
			await request(app)
				.delete(`/api/admin/users/${superAdmin.id}`)
				.set("Authorization", asSuper())
		).status,
	).toBe(403);
});

it("T-USER-09 soft delete faculty and deny later login", async () => {
	const faculty = await createFaculty();
	const response = await request(app)
		.delete(`/api/admin/users/${faculty.id}`)
		.set("Authorization", asAdmin());
	expect(response.status).toBe(200);
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: faculty.id },
		include: { faculty: true },
	});
	expect(user.isDeleted).toBe(true);
	expect(user.faculty?.isDeleted).toBe(true);
	expect(
		(
			await request(app)
				.post("/api/auth/login")
				.send({ email: faculty.email, password: "UnusedTest@123" })
		).status,
	).toBe(403);
	expect(
		(
			await request(app)
				.get(`/api/admin/users/${faculty.id}`)
				.set("Authorization", asAdmin())
		).status,
	).toBe(404);
});

it("T-USER-10 upload own profile photo and contact details", async () => {
	const student = await createStudent();
	const response = await request(app)
		.patch("/api/users/me")
		.set("Authorization", `Bearer ${tokenFor(student)}`)
		.field(
			"data",
			JSON.stringify({
				personalEmail: "personal-student@example.org",
				contactNumber: "0123456789",
			}),
		)
		.attach("photo", Buffer.from("mock image"), {
			filename: "photo.png",
			contentType: "image/png",
		});
	expect(response.status).toBe(200);
	expect(response.body.data.imageUrl).toBe("https://sandbox.test/photo.png");
	expect(response.body.data.student.personalEmail).toBe(
		"personal-student@example.org",
	);
	expect(response.body.data.password).toBeUndefined();
});

it("T-USER-11 a student cannot list admin users", async () => {
	const student = await createStudent();
	expect(
		(
			await request(app)
				.get("/api/admin/users")
				.set("Authorization", `Bearer ${tokenFor(student)}`)
		).status,
	).toBe(403);
});
