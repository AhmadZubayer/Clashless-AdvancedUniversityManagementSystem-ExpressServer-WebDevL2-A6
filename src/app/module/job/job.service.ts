import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
const getJobByIdFromDB = async (id: string) => {
	const job = await prisma.generationJob.findUnique({
		where: { id },
		select: {
			id: true,
			type: true,
			semesterId: true,
			status: true,
			progress: true,
			resultId: true,
			error: true,
			startedAt: true,
			finishedAt: true,
			createdAt: true,
		},
	});
	if (!job) throw new AppError(404, "Generation job not found");
	return job;
};
export const jobService = { getJobByIdFromDB };
