import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import config from "./app/config";
import { logger } from "./app/lib/logger";
import { swaggerDocument } from "./app/lib/swagger";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { authRoutes } from "./app/module/auth/auth.route";
import {
	registrationRoutes,
	adminRegistrationRoutes,
} from "./app/module/registration/registration.route";
import { adminJobRoutes } from "./app/module/job/job.route";
import {
	routineRoutes,
	adminRoutineRoutes,
} from "./app/module/routine/routine.route";
import {
	facultyPreferenceRoutes,
	adminFacultyPreferenceRoutes,
} from "./app/module/facultyPreference/facultyPreference.route";
import {
	sectionRoutes,
	adminSectionRoutes,
} from "./app/module/section/section.route";
import {
	offeringRoutes,
	adminOfferingRoutes,
} from "./app/module/offering/offering.route";
import {
	registrationWindowRoutes,
	adminRegistrationWindowRoutes,
} from "./app/module/registrationWindow/registrationWindow.route";
import {
	semesterRoutes,
	adminSemesterRoutes,
} from "./app/module/semester/semester.route";
import { adminResultRoutes } from "./app/module/result/result.route";
import {
	timeSlotRoutes,
	adminTimeSlotRoutes,
} from "./app/module/timeSlot/timeSlot.route";
import {
	dayPatternRoutes,
	adminDayPatternRoutes,
} from "./app/module/dayPattern/dayPattern.route";
import { roomRoutes, adminRoomRoutes } from "./app/module/room/room.route";
import {
	courseRoutes,
	adminCourseRoutes,
} from "./app/module/course/course.route";
import { batchRoutes, adminBatchRoutes } from "./app/module/batch/batch.route";
import {
	programRoutes,
	adminProgramRoutes,
} from "./app/module/program/program.route";
import { userRoutes, adminUserRoutes } from "./app/module/user/user.route";
import {
	departmentRoutes,
	adminDepartmentRoutes,
} from "./app/module/department/department.route";
import { paymentRoutes } from "./app/module/payment/payment.route";
import { bkashRoutes } from "./app/module/payment/providers/bkash/bkash.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Middleware to parse JSON bodies
app.use(express.json());
// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Basic route
app.get("/", (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: `Welcome to ${config.app_name}. Navigate to /docs for API documentation`,
	});
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/admin/departments", adminDepartmentRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/admin/programs", adminProgramRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/admin/batches", adminBatchRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/admin/courses", adminCourseRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/admin/rooms", adminRoomRoutes);
app.use("/api/time-slots", timeSlotRoutes);
app.use("/api/admin/time-slots", adminTimeSlotRoutes);
app.use("/api/day-patterns", dayPatternRoutes);
app.use("/api/admin/day-patterns", adminDayPatternRoutes);
app.use("/api/admin/results", adminResultRoutes);
app.use("/api/semesters", semesterRoutes);
app.use("/api/admin/semesters", adminSemesterRoutes);
app.use("/api/registration-windows", registrationWindowRoutes);
app.use("/api/admin/registration-windows", adminRegistrationWindowRoutes);
app.use("/api/offerings", offeringRoutes);
app.use("/api/admin/offerings", adminOfferingRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/admin/sections", adminSectionRoutes);
app.use("/api/admin/jobs", adminJobRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/admin/routines", adminRoutineRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/admin/registrations", adminRegistrationRoutes);
app.use("/api/faculty-preferences", facultyPreferenceRoutes);
app.use("/api/admin/faculty-preferences", adminFacultyPreferenceRoutes);
app.use("/api/payments/bkash", bkashRoutes);
app.use("/api/payments", paymentRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
