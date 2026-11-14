// 1,000 students select the same 40-seat section at the same moment.
// Prepare: npm run db:seed:demo -- --registration-open, start the API, then
//   npx tsx tests/load/makeTokens.ts
// Run:     npm run test:load        (BASE_URL defaults to http://localhost:5000)
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

const data = new SharedArray("tokens", () => [
	JSON.parse(open("./tokens.json")),
]);
const created = new Counter("selected_201");
const full = new Counter("section_full_409");
const other = new Counter("other_responses");
const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
	scenarios: {
		race: {
			executor: "per-vu-iterations",
			vus: 1000,
			iterations: 1,
			maxDuration: "2m",
		},
	},
	thresholds: {
		selected_201: ["count==40"],
		section_full_409: ["count==960"],
		other_responses: ["count==0"],
		http_req_duration: ["p(95)<500"],
	},
};

export default function () {
	const { sectionId, tokens } = data[0];
	const token = tokens[(__VU - 1) % tokens.length];
	const response = http.post(
		`${BASE_URL}/api/registrations/sections/${sectionId}`,
		null,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	let code = "";
	try {
		code = response.json("errorDetails.code") || "";
	} catch (_) {}
	if (response.status === 201) created.add(1);
	else if (response.status === 409 && code === "SECTION_FULL") full.add(1);
	else other.add(1);
	check(response, {
		"201 or SECTION_FULL": (r) => r.status === 201 || code === "SECTION_FULL",
	});
}
