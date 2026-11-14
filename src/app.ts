import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import httpStatus from "http-status";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import config from "./app/config";
import { logger } from "./app/lib/logger";
import { swaggerDocument } from "./app/lib/swagger";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { authRoutes } from "./app/module/auth/auth.route";
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
app.use("/api/payments/bkash", bkashRoutes);
app.use("/api/payments", paymentRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
