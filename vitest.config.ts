import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globalSetup: "tests/setup/globalSetup.ts",
		setupFiles: ["tests/setup/perFile.ts"],
		fileParallelism: false,
		testTimeout: 30000,
		hookTimeout: 60000,
		include: ["tests/**/*.test.ts"],
	},
});
