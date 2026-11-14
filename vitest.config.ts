import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		fileParallelism: false,
		testTimeout: 30000,
		hookTimeout: 60000,
		projects: [
			{ test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
			{
				test: {
					name: "integration",
					include: [
						"tests/integration/**/*.test.ts",
						"tests/performance/**/*.test.ts",
					],
					globalSetup: "tests/setup/globalSetup.ts",
					setupFiles: ["tests/setup/perFile.ts"],
					fileParallelism: false,
					testTimeout: 30000,
					hookTimeout: 60000,
				},
			},
		],
	},
});
