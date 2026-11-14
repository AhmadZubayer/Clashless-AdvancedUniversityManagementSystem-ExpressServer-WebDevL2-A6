import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import { createAcademicWorld, createAdmin } from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createAdmin>>;
beforeAll(async () => {
	admin = await createAdmin();
});
const authorization = () => `Bearer ${tokenFor(admin)}`;

it("T-ACAD-01 department codes are uppercase and unique", async () => {
	const response = await request(app)
		.post("/api/admin/departments")
		.set("Authorization", authorization())
		.send({ code: "cse", name: "Computer Science" });
	expect(response.status).toBe(201);
	expect(response.body.data.code).toBe("CSE");
	expect(
		(
			await request(app)
				.post("/api/admin/departments")
				.set("Authorization", authorization())
				.send({ code: "CSE", name: "Duplicate" })
		).status,
	).toBe(409);
	const listed = await request(app)
		.get("/api/departments?searchTerm=computer&limit=2")
		.set("Authorization", authorization());
	expect(listed.status).toBe(200);
	expect(listed.body.meta.total).toBe(1);
	const updated = await request(app)
		.patch(`/api/admin/departments/${response.body.data.id}`)
		.set("Authorization", authorization())
		.send({ name: "Updated Department" });
	expect(updated.status).toBe(200);
});

it("T-ACAD-02 cannot delete a department with a course", async () => {
	const world = await createAcademicWorld();
	await prisma.course.create({
		data: {
			code: "KEEP101",
			title: "Keep department",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	expect(
		(
			await request(app)
				.delete(`/api/admin/departments/${world.department.id}`)
				.set("Authorization", authorization())
		).status,
	).toBe(409);
});

it("T-ACAD-03 batch code derives intake values and rejects term four", async () => {
	const response = await request(app)
		.post("/api/admin/batches")
		.set("Authorization", authorization())
		.send({ code: "23-3" });
	expect(response.status).toBe(201);
	expect(response.body.data.intakeYear).toBe(2023);
	expect(response.body.data.intakeTerm).toBe(3);
	expect(
		(
			await request(app)
				.post("/api/admin/batches")
				.set("Authorization", authorization())
				.send({ code: "23-4" })
		).status,
	).toBe(400);
	expect(
		(
			await request(app)
				.post("/api/admin/batches")
				.set("Authorization", authorization())
				.send({ code: "23-3" })
		).status,
	).toBe(409);
	expect(
		(
			await request(app)
				.get("/api/batches?searchTerm=23-3")
				.set("Authorization", authorization())
		).status,
	).toBe(200);
});

it("T-ACAD-04 course credits require half-credit increments", async () => {
	const world = await createAcademicWorld();
	const response = await request(app)
		.post("/api/admin/courses")
		.set("Authorization", authorization())
		.send({
			code: "BADCR",
			title: "Invalid credits",
			credits: 2.25,
			type: "THEORY",
			departmentId: world.department.id,
		});
	expect(response.status).toBe(400);
});

it("T-ACAD-05 reject prerequisite cycles and protect offered course rules", async () => {
	const world = await createAcademicWorld();
	const create = (code: string) =>
		request(app)
			.post("/api/admin/courses")
			.set("Authorization", authorization())
			.send({
				code,
				title: code,
				credits: 3,
				type: "THEORY",
				departmentId: world.department.id,
			});
	const a = await create("cyclea");
	const b = await create("cycleb");
	expect(a.status).toBe(201);
	expect(a.body.data.code).toBe("CYCLEA");
	expect(b.status).toBe(201);
	const first = await request(app)
		.put(`/api/admin/courses/${a.body.data.id}/prerequisites`)
		.set("Authorization", authorization())
		.send([{ prerequisiteId: b.body.data.id }]);
	expect(first.status).toBe(200);
	expect(first.body.data[0].minGrade).toBe("D");
	expect(
		(
			await request(app)
				.put(`/api/admin/courses/${b.body.data.id}/prerequisites`)
				.set("Authorization", authorization())
				.send([{ prerequisiteId: a.body.data.id, minGrade: "D" }])
		).status,
	).toBe(409);
	const detail = await request(app)
		.get(`/api/courses/${a.body.data.id}`)
		.set("Authorization", authorization());
	expect(detail.status).toBe(200);
	expect(detail.body.data.prerequisites).toHaveLength(1);
	const semester = await prisma.semester.create({
		data: { code: "COURSE-TEST", name: "Course test", phase: "REGISTRATION" },
	});
	await prisma.courseOffering.create({
		data: { semesterId: semester.id, courseId: a.body.data.id },
	});
	expect(
		(
			await request(app)
				.patch(`/api/admin/courses/${a.body.data.id}`)
				.set("Authorization", authorization())
				.send({ credits: 4 })
		).status,
	).toBe(409);
	expect(
		(
			await request(app)
				.delete(`/api/admin/courses/${a.body.data.id}`)
				.set("Authorization", authorization())
		).status,
	).toBe(409);
	await prisma.semester.update({
		where: { id: semester.id },
		data: { phase: "CLOSED" },
	});
});

it("T-ACAD-06 reject a course requiring itself", async () => {
	const world = await createAcademicWorld();
	const course = await prisma.course.create({
		data: {
			code: "SELF101",
			title: "Self",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	expect(
		(
			await request(app)
				.put(`/api/admin/courses/${course.id}/prerequisites`)
				.set("Authorization", authorization())
				.send([{ prerequisiteId: course.id, minGrade: "D" }])
		).status,
	).toBe(409);
});

it("T-ACAD-09 curriculum replacement removes previous rows and program fees obey phase", async () => {
	const world = await createAcademicWorld();
	const created = await request(app)
		.post("/api/admin/programs")
		.set("Authorization", authorization())
		.send({
			code: "TESTPROGRAM",
			name: "Test program",
			departmentId: world.department.id,
			totalCreditsRequired: 148,
			perCreditFee: "6500.00",
			semesterFee: "12000.00",
		});
	expect(created.status).toBe(201);
	const id = created.body.data.id;
	const first = await prisma.course.create({
		data: {
			code: "CURR101",
			title: "First course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const second = await prisma.course.create({
		data: {
			code: "CURR102",
			title: "Second course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const initial = await request(app)
		.put(`/api/admin/programs/${id}/curriculum`)
		.set("Authorization", authorization())
		.send([
			{ courseId: first.id, term: 1 },
			{ courseId: second.id, term: 2 },
		]);
	expect(initial.status).toBe(200);
	expect(initial.body.data).toHaveLength(2);
	const replacement = await request(app)
		.put(`/api/admin/programs/${id}/curriculum`)
		.set("Authorization", authorization())
		.send([{ courseId: second.id, term: 3 }]);
	expect(replacement.status).toBe(200);
	expect(replacement.body.data).toHaveLength(1);
	expect(replacement.body.data[0].term).toBe(3);
	const detail = await request(app)
		.get(`/api/programs/${id}`)
		.set("Authorization", authorization());
	expect(detail.status).toBe(200);
	expect(detail.body.data.curriculum).toHaveLength(1);
	expect(detail.body.data.curriculum[0].course.id).toBe(second.id);
	const semester = await prisma.semester.create({
		data: { code: "FEE-TEST", name: "Fee test", phase: "REGISTRATION" },
	});
	const feeChange = await request(app)
		.patch(`/api/admin/programs/${id}`)
		.set("Authorization", authorization())
		.send({ perCreditFee: "7000.00" });
	expect(feeChange.status).toBe(409);
	expect(feeChange.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	await prisma.semester.update({
		where: { id: semester.id },
		data: { phase: "CLOSED" },
	});
});
