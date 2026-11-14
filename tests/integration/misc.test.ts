import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { tokenFor } from "../helpers/auth";
import { createAdmin, createRegistrationWorld } from "../helpers/factory";

type World = Awaited<ReturnType<typeof createRegistrationWorld>>;
let world: World;
let admin: Awaited<ReturnType<typeof createAdmin>>;
const bearer = (user: Parameters<typeof tokenFor>[0]) =>
	`Bearer ${tokenFor(user)}`;
const STUDENTS = 10;

beforeAll(async () => {
	world = await createRegistrationWorld({ sections: 2, students: STUDENTS });
	admin = await createAdmin();
});

describe("notifications, dashboards and audit log", () => {
	it("T-MISC-01 mark one notification read, then all", async () => {
		const user = world.students[0];
		await prisma.notification.createMany({
			data: [1, 2].map((n) => ({
				userId: user.id,
				type: "TEST",
				title: `Notice ${n}`,
				message: "Hello",
			})),
		});
		const unread = () =>
			request(app)
				.get("/api/notifications/me")
				.query({ unread: "true" })
				.set("Authorization", bearer(user));
		const first = await unread();
		expect(first.body.meta.total).toBe(2);
		const one = await request(app)
			.patch(`/api/notifications/${first.body.data[0].id}/read`)
			.set("Authorization", bearer(user));
		expect(one.status).toBe(200);
		expect((await unread()).body.meta.total).toBe(1);
		await request(app)
			.patch("/api/notifications/read-all")
			.set("Authorization", bearer(user));
		expect((await unread()).body.meta.total).toBe(0);
		const all = await request(app)
			.get("/api/notifications/me")
			.set("Authorization", bearer(user));
		expect(all.body.meta.total).toBe(2);
	});

	it("T-MISC-02 marking another user's notification read is a 404", async () => {
		const owner = world.students[1];
		const note = await prisma.notification.create({
			data: { userId: owner.id, type: "TEST", title: "Private", message: "x" },
		});
		const response = await request(app)
			.patch(`/api/notifications/${note.id}/read`)
			.set("Authorization", bearer(world.students[2]));
		expect(response.status).toBe(404);
		expect(
			(await prisma.notification.findUniqueOrThrow({ where: { id: note.id } }))
				.isRead,
		).toBe(false);
	});

	it("T-MISC-03 the admin dashboard matches the database after a round of selects", async () => {
		for (const user of world.students) {
			const response = await request(app)
				.post(`/api/registrations/sections/${world.sections[0].id}`)
				.set("Authorization", bearer(user));
			expect(response.status).toBe(201);
		}
		const response = await request(app)
			.get("/api/admin/analytics")
			.query({ semesterId: world.semester.id })
			.set("Authorization", bearer(admin));
		expect(response.status).toBe(200);
		const data = response.body.data;
		const batch = data.batches.find(
			(row: { batchId: string }) => row.batchId === world.batch.id,
		);
		expect(batch).toMatchObject({ registered: STUDENTS, total: STUDENTS });
		expect(data.sections.total).toBe(2);
		expect(data.sections.full).toBe(0);
		const enrolled = await prisma.section.aggregate({
			where: { offering: { semesterId: world.semester.id } },
			_sum: { enrolledCount: true },
		});
		expect(enrolled._sum.enrolledCount).toBe(STUDENTS);
		// (10 + 0) / 40 / 2 sections = 12.5 %
		expect(data.sections.averageFillPercent).toBe(12.5);
		const billed = await prisma.semesterRegistration.aggregate({
			where: { semesterId: world.semester.id },
			_sum: { totalFee: true, paidAmount: true },
		});
		expect(data.fees.billed).toBe(billed._sum.totalFee?.toString());
		expect(data.fees.collected).toBe("0");
		expect(data.payments).toMatchObject({
			unpaid: STUDENTS,
			minimumPaid: 0,
			fullyPaid: 0,
			discarded: 0,
		});
		const live = await request(app)
			.get("/api/admin/analytics/registration-live")
			.set("Authorization", bearer(admin));
		expect(live.status).toBe(200);
		expect(live.body.data.openWindows).toHaveLength(1);
		const total = live.body.data.selectionsPerMinute.reduce(
			(sum: number, row: { selections: number }) => sum + row.selections,
			0,
		);
		expect(total).toBe(STUDENTS);
	});

	it("T-MISC-04 a teacher and a student each get their own dashboard", async () => {
		const teacher = await request(app)
			.get("/api/analytics/me")
			.set("Authorization", bearer(world.faculty));
		expect(teacher.status).toBe(200);
		expect(teacher.body.data.role).toBe("FACULTY");
		expect(teacher.body.data.teachingCredits).toBe("6");
		expect(teacher.body.data.classSizes).toHaveLength(2);
		const student = await request(app)
			.get("/api/analytics/me")
			.set("Authorization", bearer(world.students[0]));
		expect(student.status).toBe(200);
		expect(student.body.data.role).toBe("STUDENT");
		expect(student.body.data.credits).toBe("3");
		expect(student.body.data.feeDue).toBe("31500");
		expect(student.body.data.nextClass.courseCode).toBeDefined();
		const denied = await request(app)
			.get("/api/analytics/me")
			.set("Authorization", bearer(admin));
		expect(denied.status).toBe(403);
	});

	it("T-MISC-05 the audit log filtered by entity shows a capacity change with before and after", async () => {
		const own = await createRegistrationWorld({ sections: 1, students: 0 });
		const change = await request(app)
			.patch(`/api/admin/sections/${own.sections[0].id}`)
			.set("Authorization", bearer(admin))
			.send({ capacity: 30 });
		expect(change.status).toBe(200);
		const response = await request(app)
			.get("/api/admin/audit-logs")
			.query({ entity: "Section", entityId: own.sections[0].id })
			.set("Authorization", bearer(admin));
		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].action).toBe("SECTION_CAPACITY_CHANGED");
		expect(response.body.data[0].before.capacity).toBe(40);
		expect(response.body.data[0].after.capacity).toBe(30);
	});
});
