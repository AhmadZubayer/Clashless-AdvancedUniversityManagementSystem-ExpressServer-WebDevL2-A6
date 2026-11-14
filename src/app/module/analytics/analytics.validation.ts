import { z } from "zod";

export const analyticsValidation = {
	querySchema: z.object({ semesterId: z.uuid().optional() }),
};
