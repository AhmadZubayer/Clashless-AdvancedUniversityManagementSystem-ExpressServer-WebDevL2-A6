import { z } from "zod";
import { registerJobHandler } from "../lib/queue";
import { examRoutineService } from "../module/examRoutine/examRoutine.service";
registerJobHandler("exam-routine", async (data) => {
	const { jobId } = z.object({ jobId: z.uuid() }).parse(data);
	return examRoutineService.processExamRoutineJobIntoDB(jobId);
});
