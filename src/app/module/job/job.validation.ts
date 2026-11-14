import { z } from "zod";
export const jobValidation = { idSchema: z.object({ id: z.uuid() }) };
