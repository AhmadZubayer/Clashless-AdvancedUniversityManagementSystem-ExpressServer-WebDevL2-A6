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
