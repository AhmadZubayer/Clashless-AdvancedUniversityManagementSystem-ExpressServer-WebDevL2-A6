import request from "supertest";
import { beforeAll, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import {
	createAcademicWorld,
	createAdmin,
	createFaculty,
	createRegistrationWorld,
	createStudent,
} from "../helpers/factory";

let admin: Awaited<ReturnType<typeof createAdmin>>;
beforeAll(async () => {
	admin = await createAdmin();
});
const authorization = () => `Bearer ${tokenFor(admin)}`;

it("T-ACAD-10 import two students' results and recompute best-attempt CGPA", async () => {
	const world = await createAcademicWorld();
	const first = await createStudent({
		program: world.program,
		batch: world.batch,
	});
	const second = await createStudent({
		program: world.program,
		batch: world.batch,
	});
	for (const [code, credits] of [
		["RESA", 3],
		["RESB", 1],
		["RESC", 2],
	] as const)
		await prisma.course.create({
			data: {
				code,
				title: code,
				credits,
				type: "THEORY",
				departmentId: world.department.id,
			},
		});
	const id1 = first.student!.universityId;
	const id2 = second.student!.universityId;
	const csv = [
		"universityId,courseCode,grade",
		`${id1},RESA,B`,
		`${id1},RESA,B_PLUS`,
		`${id1},RESA,F`,
		`${id1},RESB,A`,
		`${id1},RESC,W`,
		`${id2},RESA,F`,
		`${id2},RESB,B`,
		`${id2},UNKNOWN,A`,
	].join("\n");
	const response = await request(app)
		.post("/api/admin/results/import")
		.set("Authorization", authorization())
		.attach("file", Buffer.from(csv), "results.csv");
	expect(response.status).toBe(200);
	expect(response.body.data.created).toBe(7);
	expect(response.body.data.failed).toHaveLength(1);
	expect(response.body.data.failed[0].row).toBe(9);
	const updated1 = await prisma.student.findUniqueOrThrow({
		where: { id: first.student!.id },
	});
	const updated2 = await prisma.student.findUniqueOrThrow({
		where: { id: second.student!.id },
	});
	// First: (3.3*3 + 4*1)/4 = 3.475 -> 3.48; W and lower retakes do not count.
	expect(updated1.cgpa.toString()).toBe("3.48");
	expect(updated1.earnedCredits.toString()).toBe("4");
	// Second: (0*3 + 3*1)/4 = 0.75; only the one-credit B was earned.
	expect(updated2.cgpa.toString()).toBe("0.75");
	expect(updated2.earnedCredits.toString()).toBe("1");
	expect(
		await prisma.courseResult.count({
			where: {
				studentId: { in: [updated1.id, updated2.id] },
				semesterId: null,
			},
		}),
	).toBe(7);
});

it("T-ACAD-01 department codes are uppercase and unique", async () => {
	const response = await request(app)
		.post("/api/admin/departments")
		.set("Authorization", authorization())
		.send({ code: "cse", name: "Case normalization department" });
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
		.get("/api/departments?searchTerm=Case%20normalization&limit=2")
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

it("T-ACAD-07 reject overlapping same-type slots and protect published slot times", async () => {
	const created = await request(app)
		.post("/api/admin/time-slots")
		.set("Authorization", authorization())
		.send({ type: "THEORY", startMinute: 510, endMinute: 600 });
	expect(created.status).toBe(201);
	expect(created.body.data.label).toBe("08:30-10:00");
	expect(
		(
			await request(app)
				.post("/api/admin/time-slots")
				.set("Authorization", authorization())
				.send({ type: "THEORY", startMinute: 550, endMinute: 640 })
		).status,
	).toBe(409);
	expect(
		(
			await request(app)
				.post("/api/admin/time-slots")
				.set("Authorization", authorization())
				.send({ type: "THEORY", startMinute: 600, endMinute: 690 })
		).status,
	).toBe(201);
	expect(
		(
			await request(app)
				.post("/api/admin/time-slots")
				.set("Authorization", authorization())
				.send({ type: "LAB", startMinute: 510, endMinute: 690 })
		).status,
	).toBe(201);
	const world = await createRegistrationWorld({ students: 0 });
	expect(
		(
			await request(app)
				.patch(`/api/admin/time-slots/${world.timeSlot.id}`)
				.set("Authorization", authorization())
				.send({ startMinute: 500 })
		).status,
	).toBe(409);
	const list = await request(app)
		.get("/api/time-slots?type=THEORY")
		.set("Authorization", authorization());
	expect(list.status).toBe(200);
	expect(list.body.data[0].startMinute).toBe(510);
});

it("T-ACAD-08 THEORY patterns require two distinct days and LAB one", async () => {
	expect(
		(
			await request(app)
				.post("/api/admin/day-patterns")
				.set("Authorization", authorization())
				.send({ code: "ONE", type: "THEORY", days: ["SUN"] })
		).status,
	).toBe(400);
	expect(
		(
			await request(app)
				.post("/api/admin/day-patterns")
				.set("Authorization", authorization())
				.send({ code: "DUP", type: "THEORY", days: ["SUN", "SUN"] })
		).status,
	).toBe(400);
	expect(
		(
			await request(app)
				.post("/api/admin/day-patterns")
				.set("Authorization", authorization())
				.send({ code: "VALIDPAIR", type: "THEORY", days: ["MON", "WED"] })
		).status,
	).toBe(201);
	expect(
		(
			await request(app)
				.post("/api/admin/day-patterns")
				.set("Authorization", authorization())
				.send({ code: "VALIDLAB", type: "LAB", days: ["THU"] })
		).status,
	).toBe(201);
	expect(
		(
			await request(app)
				.get("/api/day-patterns?type=LAB")
				.set("Authorization", authorization())
		).status,
	).toBe(200);
});

it("T-ACAD-11 faculty cannot create rooms and published rooms cannot be deactivated", async () => {
	const faculty = await createFaculty();
	const payload = {
		code: "FUB-TEST",
		building: "FUB",
		roomNo: "TEST",
		type: "CLASSROOM",
		capacity: 40,
	};
	expect(
		(
			await request(app)
				.post("/api/admin/rooms")
				.set("Authorization", `Bearer ${tokenFor(faculty)}`)
				.send(payload)
		).status,
	).toBe(403);
	const created = await request(app)
		.post("/api/admin/rooms")
		.set("Authorization", authorization())
		.send(payload);
	expect(created.status).toBe(201);
	const listed = await request(app)
		.get("/api/rooms?building=FUB&minCapacity=40&isActive=true")
		.set("Authorization", `Bearer ${tokenFor(faculty)}`);
	expect(listed.status).toBe(200);
	const world = await createRegistrationWorld({ students: 0 });
	expect(
		(
			await request(app)
				.patch(`/api/admin/rooms/${world.sections[0].roomId}`)
				.set("Authorization", authorization())
				.send({ isActive: false })
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
