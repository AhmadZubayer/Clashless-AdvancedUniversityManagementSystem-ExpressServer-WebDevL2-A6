import request from "supertest";
import { expect, it } from "vitest";
import app from "../../src/app";

it("F0 smoke GET / answers 200", async () => {
	const response = await request(app).get("/");
	expect(response.status).toBe(200);
	expect(response.body.success).toBe(true);
});
