import { z } from "zod";
import { registerJobHandler } from "../lib/queue";
import { routineService } from "../module/routine/routine.service";
registerJobHandler("routine", async (data) => {
	const { jobId } = z.object({ jobId: z.uuid() }).parse(data);
	return routineService.processRoutineJobIntoDB(jobId);
});
