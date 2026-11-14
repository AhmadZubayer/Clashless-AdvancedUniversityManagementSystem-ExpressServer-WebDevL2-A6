import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import {
	createAdmin,
	createFaculty,
	createRegistrationWorld,
} from "../helpers/factory";

type World = Awaited<ReturnType<typeof createRegistrationWorld>>;
let world: World;
let admin: Awaited<ReturnType<typeof createAdmin>>;
let otherTeacher: Awaited<ReturnType<typeof createFaculty>>;
const enrollmentIds: string[] = [];
const bearer = (user: Parameters<typeof tokenFor>[0]) =>
	`Bearer ${tokenFor(user)}`;
const sectionPath = () => `/api/grades/sections/${world.sections[0].id}`;
const submit = (
	user: Parameters<typeof tokenFor>[0],
	grades: { enrollmentId: string; grade: string }[],
) =>
	request(app)
		.put(sectionPath())
		.set("Authorization", bearer(user))
		.send({ grades });

beforeAll(async () => {
	world = await createRegistrationWorld({ sections: 1, students: 3 });
	admin = await createAdmin();
	otherTeacher = await createFaculty(world.department.id);
	await prisma.semester.update({
		where: { id: world.semester.id },
		data: { phase: "EXAMS" },
	});
	for (const user of world.students) {
		const registration = await prisma.semesterRegistration.create({
			data: {
				studentId: user.student!.id,
				semesterId: world.semester.id,
				paymentDeadline: new Date(Date.now() + 86400000),
			},
		});
		const enrollment = await prisma.enrollment.create({
			data: {
				registrationId: registration.id,
				studentId: user.student!.id,
				sectionId: world.sections[0].id,
				offeringId: world.offering.id,
				semesterId: world.semester.id,
				credits: 3,
			},
		});
		enrollmentIds.push(enrollment.id);
	}
	// student 0: failed this course before (retake) and has an A in another course
	const other = await prisma.course.create({
		data: {
			code: "HIST-1",
			title: "History",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	await prisma.courseResult.createMany({
		data: [
			{
				studentId: world.students[0].student!.id,
				courseId: world.course.id,
				grade: "F",
				gradePoint: 0,
				credits: 3,
			},
			{
				studentId: world.students[0].student!.id,
				courseId: other.id,
				grade: "A",
				gradePoint: 4,
				credits: 3,
			},
		],
	});
});

describe("grades", () => {
	it("T-GRADE-01 another teacher's section is refused", async () => {
		const response = await submit(otherTeacher, [
			{ enrollmentId: enrollmentIds[0], grade: "A" },
		]);
		expect(response.status).toBe(403);
	});

	it("T-GRADE-02 submitting after the grade deadline is refused", async () => {
		await prisma.semester.update({
			where: { id: world.semester.id },
			data: { gradeDeadline: new Date(Date.now() - 60000) },
		});
		const late = await submit(world.faculty, [
			{ enrollmentId: enrollmentIds[0], grade: "B" },
		]);
		expect(late.status).toBe(409);
		await prisma.semester.update({
			where: { id: world.semester.id },
			data: { gradeDeadline: new Date(Date.now() + 86400000) },
		});
		const bad = await submit(world.faculty, [
			{ enrollmentId: "00000000-0000-4000-8000-000000000000", grade: "B" },
		]);
		expect(bad.status).toBe(400);
	});

	it("T-GRADE-03 publishing with a section missing grades names the section", async () => {
		const ok = await submit(world.faculty, [
			{ enrollmentId: enrollmentIds[0], grade: "B" },
			{ enrollmentId: enrollmentIds[1], grade: "C" },
		]);
		expect(ok.status).toBe(200);
		await prisma.semester.update({
			where: { id: world.semester.id },
			data: { phase: "GRADING" },
		});
		const status = await request(app)
			.get("/api/admin/grades/status")
			.query({ semesterId: world.semester.id })
			.set("Authorization", bearer(admin));
		expect(status.body.data[0]).toMatchObject({ submitted: 2, missing: 1 });
		const response = await request(app)
			.post("/api/admin/grades/publish")
			.set("Authorization", bearer(admin))
			.send({ semesterId: world.semester.id });
		expect(response.status).toBe(409);
		expect(response.body.errorDetails.sections[0].sectionId).toBe(
			world.sections[0].id,
		);
		const sheet = await request(app)
			.get(sectionPath())
			.set("Authorization", bearer(world.faculty));
		expect(sheet.body.data.students).toHaveLength(3);
	});

	it("T-GRADE-04 publishing creates results and the CGPA matches a hand calculation", async () => {
		await submit(world.faculty, [
			{ enrollmentId: enrollmentIds[2], grade: "F" },
		]);
		const response = await request(app)
			.post("/api/admin/grades/publish")
			.set("Authorization", bearer(admin))
			.send({ semesterId: world.semester.id });
		expect(response.status).toBe(200);
		expect(
			await prisma.courseResult.count({
				where: { semesterId: world.semester.id },
			}),
		).toBe(3);
		// student 0: retake B (3.0) replaces F; A (4.0): (3*3 + 4*3) / 6 = 3.50
		const first = await prisma.student.findUniqueOrThrow({
			where: { id: world.students[0].student!.id },
		});
		expect(first.cgpa.toString()).toBe("3.5");
		expect(first.earnedCredits.toString()).toBe("6");
		const second = await prisma.student.findUniqueOrThrow({
			where: { id: world.students[1].student!.id },
		});
		expect(second.cgpa.toString()).toBe("2");
		const failed = await prisma.student.findUniqueOrThrow({
			where: { id: world.students[2].student!.id },
		});
		expect(failed.cgpa.toString()).toBe("0");
		expect(failed.earnedCredits.toString()).toBe("0");
	});

	it("T-GRADE-05 submitting after publishing is refused", async () => {
		const response = await submit(world.faculty, [
			{ enrollmentId: enrollmentIds[0], grade: "A" },
		]);
		expect(response.status).toBe(409);
		const again = await request(app)
			.post("/api/admin/grades/publish")
			.set("Authorization", bearer(admin))
			.send({ semesterId: world.semester.id });
		expect(again.status).toBe(409);
	});

	it("T-GRADE-06 a student sees the semester GPA and CGPA", async () => {
		const response = await request(app)
			.get("/api/grades/me")
			.set("Authorization", bearer(world.students[0]));
		expect(response.status).toBe(200);
		expect(response.body.data.cgpa).toBe("3.5");
		const semester = response.body.data.semesters.find(
			(row: { semester: { id: string } | null }) =>
				row.semester?.id === world.semester.id,
		);
		expect(semester.gpa).toBe("3");
		expect(semester.courses).toHaveLength(1);
	});
});
