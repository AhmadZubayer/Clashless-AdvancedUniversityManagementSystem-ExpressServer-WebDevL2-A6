import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import app from "../../src/app";
import { prisma } from "../../src/app/lib/prisma";
import { redisClient, redisKey } from "../../src/app/lib/redis";
import { tokenFor } from "../helpers/auth";
import { createAcademicWorld, createStudent } from "../helpers/factory";

let testServer: ReturnType<typeof app.listen>;
let world: Awaited<ReturnType<typeof createAcademicWorld>>;
let student: Awaited<ReturnType<typeof createStudent>>;
let semesterId: string;
let sectionId: string;
let alternativeId: string;
let windowId: string;
let windowEnd: Date;
const authorization = () => `Bearer ${tokenFor(student)}`;
let originalEnrollmentId: string;
let targetStudent: Awaited<ReturnType<typeof createStudent>>;
beforeEach(async () => {
	const ids = [
		student?.student?.id,
		readStudent?.student?.id,
		guardStudent?.student?.id,
		creditStudent?.student?.id,
	].filter((id): id is string => !!id);
	if (ids.length)
		await redisClient.del(
			ids.map((id) => redisKey(`rate-limit-registration:${id}`)),
		);
});
beforeAll(async () => {
	testServer = app.listen(0);
	await new Promise<void>((resolve) => testServer.once("listening", resolve));
	world = await createAcademicWorld();
	student = await createStudent({ batch: world.batch, program: world.program });
	const semester = await prisma.semester.create({
		data: { code: "F7-REG", name: "Registration test", phase: "REGISTRATION" },
	});
	semesterId = semester.id;
	windowEnd = new Date(Date.now() + 3600000);
	const window = await prisma.registrationWindow.create({
		data: {
			batchId: world.batch.id,
			semesterId,
			startsAt: new Date(Date.now() - 3600000),
			endsAt: windowEnd,
		},
	});
	windowId = window.id;
	const course = await prisma.course.create({
		data: {
			code: "F7-C1",
			title: "Registration course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const room = await prisma.room.create({
		data: {
			code: "F7-R1",
			building: "F7",
			roomNo: "1",
			type: "CLASSROOM",
			capacity: 100,
		},
	});
	const slot = await prisma.timeSlot.create({
		data: {
			label: "08:30-10:00",
			type: "THEORY",
			startMinute: 510,
			endMinute: 600,
		},
	});
	const pattern = await prisma.dayPattern.create({
		data: { code: "F7-ST", type: "THEORY", days: ["SUN", "TUE"] },
	});
	const section = await prisma.section.create({
		data: {
			offeringId: offering.id,
			sectionNo: 1,
			roomId: room.id,
			dayPatternId: pattern.id,
			timeSlotId: slot.id,
		},
	});
	sectionId = section.id;
	alternativeId = (
		await prisma.section.create({
			data: {
				offeringId: offering.id,
				sectionNo: 2,
				roomId: room.id,
				dayPatternId: pattern.id,
				timeSlotId: slot.id,
			},
		})
	).id;
});
it("T-REG-01 selections before and after the batch window are forbidden", async () => {
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: { startsAt: new Date(Date.now() + 100000) },
	});
	const before = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(before.status).toBe(403);
	expect(before.body.errorDetails.code).toBe("WINDOW_NOT_OPEN");
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: {
			startsAt: new Date(Date.now() - 100000),
			endsAt: new Date(Date.now() - 1000),
		},
	});
	const after = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(after.status).toBe(403);
	expect(after.body.errorDetails.code).toBe("WINDOW_CLOSED");
	await prisma.registrationWindow.update({
		where: { id: windowId },
		data: { endsAt: windowEnd },
	});
});
it("T-REG-02 selections require REGISTRATION phase", async () => {
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "PLANNING" },
	});
	const response = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("PHASE_NOT_ALLOWED");
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
});
it("T-REG-03 first select creates a bill with exact credits, fee and batch-relative deadline", async () => {
	const response = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(201);
	expect(response.body.data.enrollment.status).toBe("ENROLLED");
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "3",
		totalFee: "31500",
		paidAmount: "0",
		paymentStatus: "UNPAID",
		paymentDeadline: new Date(
			windowEnd.getTime() + 12 * 86400000,
		).toISOString(),
	});
	const repeated = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(repeated.status).toBe(200);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(1);
});
it("T-REG-04 another section of the same course is rejected", async () => {
	const response = await request(testServer)
		.post(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("ALREADY_HAS_COURSE");
});
it("T-REG-13 unselect drops the enrollment and removes the semester fee without refunding paid credit", async () => {
	const bill = await prisma.semesterRegistration.findUniqueOrThrow({
		where: {
			unique_student_semester: { studentId: student.student!.id, semesterId },
		},
	});
	await prisma.semesterRegistration.update({
		where: { id: bill.id },
		data: { paidAmount: 10000 },
	});
	const response = await request(testServer)
		.delete(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(200);
	expect(response.body.data.enrollment.status).toBe("DROPPED");
	originalEnrollmentId = response.body.data.enrollment.id;
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "0",
		totalFee: "0",
		paidAmount: "10000",
		paymentStatus: "FULLY_PAID",
	});
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(0);
});
it("T-REG-14 selecting again reuses the original dropped enrollment", async () => {
	const response = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", authorization());
	expect(response.status).toBe(201);
	expect(response.body.data.enrollment).toMatchObject({
		id: originalEnrollmentId,
		status: "ENROLLED",
		droppedAt: null,
	});
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "3",
		totalFee: "31500",
		paidAmount: "10000",
		paymentStatus: "UNPAID",
	});
});
it("T-REG-15 switching to a full section retains the source enrollment and count", async () => {
	targetStudent = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	await prisma.section.update({
		where: { id: alternativeId },
		data: { capacity: 1 },
	});
	const fill = await request(testServer)
		.post(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", `Bearer ${tokenFor(targetStudent)}`);
	expect(fill.status).toBe(201);
	const response = await request(testServer)
		.post("/api/registrations/switch")
		.set("Authorization", authorization())
		.send({ fromSectionId: sectionId, toSectionId: alternativeId });
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("SECTION_FULL");
	expect(
		(
			await prisma.enrollment.findUniqueOrThrow({
				where: { id: originalEnrollmentId },
			})
		).status,
	).toBe("ENROLLED");
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(1);
});
it("T-REG-16 switching to an available section changes both counts and preserves billing", async () => {
	const release = await request(testServer)
		.delete(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", `Bearer ${tokenFor(targetStudent)}`);
	expect(release.status).toBe(200);
	const response = await request(testServer)
		.post("/api/registrations/switch")
		.set("Authorization", authorization())
		.send({ fromSectionId: sectionId, toSectionId: alternativeId });
	expect(response.status).toBe(200);
	expect(response.body.data.fromEnrollment).toMatchObject({
		id: originalEnrollmentId,
		status: "DROPPED",
	});
	expect(response.body.data.enrollment).toMatchObject({
		sectionId: alternativeId,
		status: "ENROLLED",
		credits: "3",
	});
	expect(response.body.data.registration).toMatchObject({
		totalCredits: "3",
		totalFee: "31500",
		paidAmount: "10000",
	});
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(0);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: alternativeId } }))
			.enrolledCount,
	).toBe(1);
});
it("F7 opposite switches do not deadlock and both complete when capacity allows", async () => {
	const { left, right, ids } = oppositeFixture;
	const responses = await Promise.all([
		request(testServer)
			.post("/api/registrations/switch")
			.set("Authorization", `Bearer ${tokenFor(left)}`)
			.send({ fromSectionId: ids[0], toSectionId: ids[1] }),
		request(testServer)
			.post("/api/registrations/switch")
			.set("Authorization", `Bearer ${tokenFor(right)}`)
			.send({ fromSectionId: ids[1], toSectionId: ids[0] }),
	]);
	expect(responses.map((response) => response.status)).toEqual([200, 200]);
	expect(responses[0].body.data.enrollment.sectionId).toBe(ids[1]);
	expect(responses[1].body.data.enrollment.sectionId).toBe(ids[0]);
	for (const id of ids)
		expect(
			(await prisma.section.findUniqueOrThrow({ where: { id } })).enrolledCount,
		).toBe(1);
});
it("T-REG-11 parallel selections by one student serialize the credit-limit check", async () => {
	const { user, sections, registration } = parallelFixture;
	const responses = await Promise.all(
		sections.slice(2).map((section) =>
			request(testServer)
				.post(`/api/registrations/sections/${section.id}`)
				.set("Authorization", `Bearer ${tokenFor(user)}`),
		),
	);
	expect(responses.filter((response) => response.status === 201)).toHaveLength(
		3,
	);
	expect(
		responses.filter(
			(response) =>
				response.status === 409 &&
				response.body.errorDetails.code === "CREDIT_LIMIT",
		),
	).toHaveLength(2);
	expect(
		(
			await prisma.semesterRegistration.findUniqueOrThrow({
				where: { id: registration.id },
			})
		).totalCredits.toString(),
	).toBe("15");
	expect(
		await prisma.enrollment.count({
			where: { registrationId: registration.id, status: "ENROLLED" },
		}),
	).toBe(5);
});
it("T-REG-10 one hundred students race for exactly forty seats", async () => {
	const { users, section } = raceFixture;
	const responses = await Promise.all(
		users.map((user) =>
			request(testServer)
				.post(`/api/registrations/sections/${section.id}`)
				.set("Authorization", `Bearer ${tokenFor(user)}`),
		),
	);
	expect(responses.filter((response) => response.status === 201)).toHaveLength(
		40,
	);
	expect(
		responses.filter(
			(response) =>
				response.status === 409 &&
				response.body.errorDetails.code === "SECTION_FULL",
		),
	).toHaveLength(60);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: section.id } }))
			.enrolledCount,
	).toBe(40);
	expect(
		await prisma.enrollment.count({
			where: { sectionId: section.id, status: "ENROLLED" },
		}),
	).toBe(40);
}, 120000);

it("T-REG-12 the same idempotency key returns the original response unchanged for ten minutes", async () => {
	const user = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const key = randomUUID();
	const auth = `Bearer ${tokenFor(user)}`;
	const first = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", auth)
		.set("Idempotency-Key", key);
	expect(first.status).toBe(201);
	const second = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", auth)
		.set("Idempotency-Key", key);
	expect(second.status).toBe(first.status);
	expect(second.body).toEqual(first.body);
	const ttl = await redisClient.ttl(redisKey(`idempotency:${user.id}:${key}`));
	expect(ttl).toBeGreaterThan(590);
	expect(ttl).toBeLessThanOrEqual(600);
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "PLANNING" },
	});
	const replay = await request(testServer)
		.post(`/api/registrations/sections/${alternativeId}`)
		.set("Authorization", auth)
		.set("Idempotency-Key", key);
	expect(replay.status).toBe(201);
	expect(replay.body).toEqual(first.body);
	await prisma.semester.update({
		where: { id: semesterId },
		data: { phase: "REGISTRATION" },
	});
	expect(
		await prisma.enrollment.count({
			where: { studentId: user.student!.id, status: "ENROLLED" },
		}),
	).toBe(1);
});

it("F7 simultaneous first requests with one idempotency key share one response and seat", async () => {
	const user = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const key = randomUUID();
	const before = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const responses = await Promise.all(
		Array.from({ length: 5 }, () =>
			request(testServer)
				.post(`/api/registrations/sections/${sectionId}`)
				.set("Authorization", `Bearer ${tokenFor(user)}`)
				.set("Idempotency-Key", key),
		),
	);
	expect(responses.every((response) => response.status === 201)).toBe(true);
	for (const response of responses)
		expect(response.body).toEqual(responses[0].body);
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: sectionId } }))
			.enrolledCount,
	).toBe(before.enrolledCount + 1);
	expect(
		await redisClient.exists(redisKey(`idempotency-lock:${user.id}:${key}`)),
	).toBe(0);
});

it("T-REG-17 the eleventh registration request within ten seconds is rate limited", async () => {
	const user = readStudent;
	await redisClient.del(
		redisKey(`rate-limit-registration:${user.student!.id}`),
	);
	// Valid cached retries still count, as the rate guard precedes idempotency.
	const responses = await Promise.all(
		Array.from({ length: 10 }, () =>
			request(testServer)
				.post(`/api/registrations/sections/${readSectionId}`)
				.set("Authorization", `Bearer ${tokenFor(user)}`)
				.set("Idempotency-Key", rateIdempotencyKey),
		),
	);
	expect(
		responses.every(
			(response) => response.status === 201 || response.status === 200,
		),
	).toBe(true);
	const last = await request(testServer)
		.post(`/api/registrations/sections/${readSectionId}`)
		.set("Authorization", `Bearer ${tokenFor(user)}`)
		.set("Idempotency-Key", rateIdempotencyKey);
	expect(last.status).toBe(429);
	expect(last.body.errorDetails.code).toBe("RATE_LIMITED");
	const ttl = await redisClient.pTTL(
		redisKey(`rate-limit-registration:${user.student!.id}`),
	);
	expect(ttl).toBeGreaterThan(0);
	expect(ttl).toBeLessThanOrEqual(10000);
});

let readStudent: Awaited<ReturnType<typeof createStudent>>;
let readSectionId: string;
let readAlternativeId: string;
let clashingSectionId: string;
beforeAll(async () => {
	readStudent = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const courses = ["F7-READ", "F7-CLASH", "F7-PRE"].map((code) => ({
		id: randomUUID(),
		code,
		title: code,
		credits: 3,
		type: "THEORY" as const,
		departmentId: world.department.id,
	}));
	const offerings = courses
		.slice(0, 2)
		.map((course) => ({ id: randomUUID(), courseId: course.id, semesterId }));
	readSectionId = randomUUID();
	readAlternativeId = randomUUID();
	clashingSectionId = randomUUID();
	await prisma.$transaction([
		prisma.course.createMany({ data: courses }),
		prisma.courseOffering.createMany({ data: offerings }),
		prisma.section.createMany({
			data: [readSectionId, readAlternativeId, clashingSectionId].map(
				(id, index) => ({
					id,
					offeringId: offerings[index < 2 ? 0 : 1].id,
					sectionNo: index === 1 ? 2 : 1,
					roomId: original.roomId,
					timeSlotId: original.timeSlotId,
					dayPatternId: original.dayPatternId,
					enrolledCount: index === 0 ? 1 : 0,
				}),
			),
		}),
		prisma.coursePrerequisite.create({
			data: { courseId: courses[1].id, prerequisiteId: courses[2].id },
		}),
	]);
	await prisma.semesterRegistration.create({
		data: {
			semesterId,
			studentId: readStudent.student!.id,
			paymentDeadline: new Date(windowEnd.getTime() + 12 * 86400000),
			totalCredits: 3,
			totalFee: 31500,
			enrollments: {
				create: {
					studentId: readStudent.student!.id,
					semesterId,
					sectionId: readSectionId,
					offeringId: offerings[0].id,
					credits: 3,
				},
			},
		},
	});
});
it("F7 registration page is empty before the first selection", async () => {
	const user = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const response = await request(testServer)
		.get("/api/registrations/me")
		.set("Authorization", `Bearer ${tokenFor(user)}`);
	expect(response.status, response.body.message).toBe(200);
	expect(response.body.data).toMatchObject({
		registration: null,
		sections: [],
		window: { isOpen: true, closesAt: windowEnd.toISOString() },
	});
});
it("F7 registration page shows minimum payment, max credits and only enrolled sections", async () => {
	const response = await request(testServer)
		.get("/api/registrations/me")
		.set("Authorization", `Bearer ${tokenFor(readStudent)}`);
	expect(response.status, response.body.message).toBe(200);
	expect(response.body.data.registration).toMatchObject({
		maxCredits: "15",
		minimumPayment: "12600",
		totalFee: "31500",
	});
	expect(
		response.body.data.sections.map((row: { id: string }) => row.id),
	).toEqual([readSectionId]);
	expect(
		Number.isFinite(Date.parse(response.body.data.window.serverTime)),
	).toBe(true);
});
it("T-REG-21 catalog flags reflect own courses, clashes and prerequisites while seat counts stay live", async () => {
	const auth = `Bearer ${tokenFor(readStudent)}`;
	const cacheKey = redisKey(`catalog:${semesterId}`);
	await redisClient.del(cacheKey);
	const catalog = await request(testServer)
		.get("/api/registrations/offerings?limit=100")
		.set("Authorization", auth);
	expect(catalog.status).toBe(200);
	const sections = catalog.body.data.flatMap(
		(row: { sections: Record<string, unknown>[] }) => row.sections,
	);
	expect(
		sections.find((row: { id: string }) => row.id === readAlternativeId),
	).toMatchObject({ hasCourse: true });
	expect(
		sections.find((row: { id: string }) => row.id === clashingSectionId),
	).toMatchObject({ clash: true, prerequisiteMissing: true, hasCourse: false });
	const cached = await redisClient.get(cacheKey);
	expect(cached).toBeTruthy();
	const cachedSections = JSON.parse(cached!).flatMap(
		(row: { sections: Record<string, unknown>[] }) => row.sections,
	);
	expect(
		cachedSections.every(
			(row: Record<string, unknown>) =>
				!Object.hasOwn(row, "enrolledCount") && !Object.hasOwn(row, "capacity"),
		),
	).toBe(true);
	await prisma.section.update({
		where: { id: clashingSectionId },
		data: { capacity: 1, enrolledCount: 1 },
	});
	const live = await request(testServer)
		.get("/api/registrations/offerings?searchTerm=F7-CLASH")
		.set("Authorization", auth);
	expect(live.status).toBe(200);
	expect(live.body.data[0].sections[0]).toMatchObject({
		capacity: 1,
		enrolledCount: 1,
		seatsLeft: 0,
		full: true,
	});
	expect(await redisClient.get(cacheKey)).toBe(cached);
	const ttl = await redisClient.ttl(cacheKey);
	expect(ttl).toBeGreaterThan(0);
	expect(ttl).toBeLessThanOrEqual(30);
});

it("T-REG-20 the seat stream receives another student's selection and unsubscribes on disconnect", async () => {
	const selector = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const channel = redisKey(`seats:${semesterId}`);
	const baseline = (await redisClient.pubSubNumSub(channel))[channel];
	const server = app.listen(0);
	await new Promise<void>((resolve) => server.once("listening", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Test listener address unavailable");
	const abort = new AbortController();
	const timeout = setTimeout(() => abort.abort(), 25000);
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try {
		const response = await fetch(
			`http://localhost:${address.port}/api/registrations/seats/stream`,
			{ headers: { Authorization: authorization() }, signal: abort.signal },
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/event-stream");
		expect(response.headers.get("cache-control")).toContain("no-cache");
		if (!response.body) throw new Error("Missing event stream body");
		reader = response.body.getReader();
		const selected = await request(testServer)
			.post(`/api/registrations/sections/${sectionId}`)
			.set("Authorization", `Bearer ${tokenFor(selector)}`);
		expect(selected.status).toBe(201);
		const current = await prisma.section.findUniqueOrThrow({
			where: { id: sectionId },
		});
		const decoder = new TextDecoder();
		let buffer = "";
		let event:
			| { sectionId: string; enrolledCount: number; capacity: number }
			| undefined;
		while (!event) {
			const part = await reader.read();
			if (part.done)
				throw new Error("Event stream ended before the selection event");
			buffer += decoder.decode(part.value, { stream: true });
			const match = /data: (\{[^\n]*\})/.exec(buffer);
			if (match) event = JSON.parse(match[1]);
		}
		expect(event).toEqual({
			sectionId,
			enrolledCount: current.enrolledCount,
			capacity: current.capacity,
		});
	} finally {
		clearTimeout(timeout);
		abort.abort();
		await reader?.cancel().catch(() => {});
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
	let count = (await redisClient.pubSubNumSub(channel))[channel];
	for (let attempt = 0; attempt < 10 && count !== baseline; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 50));
		count = (await redisClient.pubSubNumSub(channel))[channel];
	}
	expect(count).toBe(baseline);
});

let parallelFixture: Awaited<ReturnType<typeof createParallelFixture>>;
async function createParallelFixture() {
	const user = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const courses = Array.from({ length: 7 }, (_, index) => ({
		id: randomUUID(),
		code: `F7-PARALLEL-${index}`,
		title: `Parallel ${index}`,
		credits: 3,
		type: "THEORY" as const,
		departmentId: world.department.id,
	}));
	const offerings = courses.map((course) => ({
		id: randomUUID(),
		courseId: course.id,
		semesterId,
	}));
	const slots = courses.map((_course, index) => ({
		id: randomUUID(),
		label: `Parallel ${index}`,
		type: "THEORY" as const,
		startMinute: 610 + index * 90,
		endMinute: 700 + index * 90,
	}));
	const sections = offerings.map((offering, index) => ({
		id: randomUUID(),
		offeringId: offering.id,
		sectionNo: 1,
		roomId: original.roomId,
		dayPatternId: original.dayPatternId,
		timeSlotId: slots[index].id,
		enrolledCount: index < 2 ? 1 : 0,
	}));
	await prisma.$transaction([
		prisma.course.createMany({ data: courses }),
		prisma.courseOffering.createMany({ data: offerings }),
		prisma.timeSlot.createMany({ data: slots }),
		prisma.section.createMany({ data: sections }),
	]);
	const registration = await prisma.semesterRegistration.create({
		data: {
			semesterId,
			studentId: user.student!.id,
			paymentDeadline: new Date(windowEnd.getTime() + 12 * 86400000),
			totalCredits: 6,
			totalFee: 51000,
		},
	});
	await prisma.enrollment.createMany({
		data: sections.slice(0, 2).map((section) => ({
			studentId: user.student!.id,
			semesterId,
			registrationId: registration.id,
			sectionId: section.id,
			offeringId: section.offeringId,
			credits: 3,
		})),
	});

	return { user, sections, registration };
}
beforeAll(async () => {
	parallelFixture = await createParallelFixture();
});

let raceFixture: Awaited<ReturnType<typeof createRaceFixture>>;
async function createRaceFixture() {
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const course = await prisma.course.create({
		data: {
			code: "F7-RACE",
			title: "Concurrency course",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const section = await prisma.section.create({
		data: {
			offeringId: offering.id,
			sectionNo: 1,
			capacity: 40,
			roomId: original.roomId,
			dayPatternId: original.dayPatternId,
			timeSlotId: original.timeSlotId,
		},
	});
	const users = Array.from({ length: 100 }, (_, index) => ({
		id: randomUUID(),
		name: `Race ${index}`,
		email: `race-${index}@uni.edu`,
		role: "STUDENT" as const,
		tokenVersion: 0,
		emailVerified: true,
	}));
	await prisma.$transaction([
		prisma.user.createMany({ data: users }),
		prisma.student.createMany({
			data: users.map((user, index) => ({
				id: randomUUID(),
				name: user.name,
				email: user.email,
				universityId: `F7-RACE-${index}`,
				userId: user.id,
				programId: world.program.id,
				batchId: world.batch.id,
			})),
		}),
	]);

	return { users, section };
}
beforeAll(async () => {
	raceFixture = await createRaceFixture();
});
const rateIdempotencyKey = randomUUID();
beforeAll(async () => {
	const prime = await request(testServer)
		.post(`/api/registrations/sections/${readSectionId}`)
		.set("Authorization", `Bearer ${tokenFor(readStudent)}`)
		.set("Idempotency-Key", rateIdempotencyKey);
	expect(prime.status).toBe(200);
});

let guardStudent: Awaited<ReturnType<typeof createStudent>>;
let creditStudent: Awaited<ReturnType<typeof createStudent>>;
let creditRegistrationId: string;
beforeAll(async () => {
	guardStudent = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	creditStudent = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const course = await prisma.course.create({
		data: {
			code: "F7-FOUR-CREDITS",
			title: "Four-credit course",
			credits: 4,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const four = await prisma.section.create({
		data: {
			offeringId: offering.id,
			sectionNo: 1,
			roomId: original.roomId,
			timeSlotId: original.timeSlotId,
			dayPatternId: original.dayPatternId,
			enrolledCount: 1,
		},
	});
	const registration = await prisma.semesterRegistration.create({
		data: {
			studentId: creditStudent.student!.id,
			semesterId,
			totalCredits: 13,
			totalFee: 96500,
			paymentDeadline: new Date(windowEnd.getTime() + 12 * 86400000),
		},
	});
	creditRegistrationId = registration.id;
	await prisma.enrollment.createMany({
		data: [
			...parallelFixture.sections.slice(0, 3).map((section) => ({
				studentId: creditStudent.student!.id,
				semesterId,
				registrationId: registration.id,
				sectionId: section.id,
				offeringId: section.offeringId,
				credits: 3,
			})),
			{
				studentId: creditStudent.student!.id,
				semesterId,
				registrationId: registration.id,
				sectionId: four.id,
				offeringId: four.offeringId,
				credits: 4,
			},
		],
	});
	await prisma.section.updateMany({
		where: {
			id: {
				in: parallelFixture.sections.slice(0, 3).map((section) => section.id),
			},
		},
		data: { enrolledCount: { increment: 1 } },
	});
});

it("T-REG-05 overlapping days and times reject selection and name the held course", async () => {
	const response = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", `Bearer ${tokenFor(readStudent)}`);
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("TIME_CLASH");
	expect(response.body.message).toContain("F7-READ");
});
it("T-REG-06 selecting three more credits from thirteen rejects the sixteen-credit total", async () => {
	const target = parallelFixture.sections[4];
	const response = await request(testServer)
		.post(`/api/registrations/sections/${target.id}`)
		.set("Authorization", `Bearer ${tokenFor(creditStudent)}`);
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("CREDIT_LIMIT");
	expect(
		(
			await prisma.semesterRegistration.findUniqueOrThrow({
				where: { id: creditRegistrationId },
			})
		).totalCredits.toString(),
	).toBe("13");
});
it("T-REG-07 a missing prerequisite rejects selection with the required course", async () => {
	const response = await request(testServer)
		.post(`/api/registrations/sections/${clashingSectionId}`)
		.set("Authorization", `Bearer ${tokenFor(guardStudent)}`);
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("PREREQUISITE_MISSING");
	expect(response.body.errorDetails.prerequisites[0].code).toBe("F7-PRE");
});
it("T-REG-08 closed sections cannot be selected", async () => {
	const target = parallelFixture.sections[6];
	await prisma.section.update({
		where: { id: target.id },
		data: { status: "CLOSED" },
	});
	const response = await request(testServer)
		.post(`/api/registrations/sections/${target.id}`)
		.set("Authorization", `Bearer ${tokenFor(guardStudent)}`);
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("SECTION_CLOSED");
	await prisma.section.update({
		where: { id: target.id },
		data: { status: "OPEN" },
	});
});
it("T-REG-09 the forty-first student gets SECTION_FULL and an open alternative", async () => {
	const full = raceFixture.section;
	expect(
		(await prisma.section.findUniqueOrThrow({ where: { id: full.id } }))
			.enrolledCount,
	).toBe(40);
	const alternative = await prisma.section.create({
		data: {
			offeringId: full.offeringId,
			sectionNo: 2,
			roomId: full.roomId,
			dayPatternId: full.dayPatternId,
			timeSlotId: full.timeSlotId,
		},
	});
	const response = await request(testServer)
		.post(`/api/registrations/sections/${full.id}`)
		.set("Authorization", `Bearer ${tokenFor(guardStudent)}`);
	expect(response.status).toBe(409);
	expect(response.body.errorDetails.code).toBe("SECTION_FULL");
	expect(response.body.errorDetails.alternatives).toContainEqual({
		id: alternative.id,
		sectionNo: 2,
		enrolledCount: 0,
		capacity: 40,
	});
});
it("T-REG-18 discarded registrations cannot select a section", async () => {
	await prisma.semesterRegistration.upsert({
		where: {
			unique_student_semester: {
				studentId: guardStudent.student!.id,
				semesterId,
			},
		},
		create: {
			studentId: guardStudent.student!.id,
			semesterId,
			status: "DISCARDED",
			paymentDeadline: windowEnd,
		},
		update: { status: "DISCARDED" },
	});
	const response = await request(testServer)
		.post(`/api/registrations/sections/${sectionId}`)
		.set("Authorization", `Bearer ${tokenFor(guardStudent)}`);
	expect(response.status).toBe(403);
	expect(response.body.errorDetails.code).toBe("REGISTRATION_DISCARDED");
});

let oppositeFixture: {
	left: Awaited<ReturnType<typeof createStudent>>;
	right: Awaited<ReturnType<typeof createStudent>>;
	ids: string[];
};
beforeAll(async () => {
	const left = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const right = await createStudent({
		batch: world.batch,
		program: world.program,
	});
	const original = await prisma.section.findUniqueOrThrow({
		where: { id: sectionId },
	});
	const course = await prisma.course.create({
		data: {
			code: "F7-OPPOSITE",
			title: "Opposite switches",
			credits: 3,
			type: "THEORY",
			departmentId: world.department.id,
		},
	});
	const offering = await prisma.courseOffering.create({
		data: { semesterId, courseId: course.id },
	});
	const ids = [randomUUID(), randomUUID()];
	await prisma.section.createMany({
		data: ids.map((id, index) => ({
			id,
			offeringId: offering.id,
			sectionNo: index + 1,
			capacity: 4,
			roomId: original.roomId,
			timeSlotId: original.timeSlotId,
			dayPatternId: original.dayPatternId,
		})),
	});
	for (const [user, id] of [
		[left, ids[0]],
		[right, ids[1]],
	] as const) {
		const selected = await request(testServer)
			.post(`/api/registrations/sections/${id}`)
			.set("Authorization", `Bearer ${tokenFor(user)}`);
		expect(selected.status).toBe(201);
	}
	oppositeFixture = { left, right, ids };
});
afterAll(async () => {
	testServer.closeAllConnections();
	await new Promise<void>((resolve, reject) =>
		testServer.close((error) => (error ? reject(error) : resolve())),
	);
});
