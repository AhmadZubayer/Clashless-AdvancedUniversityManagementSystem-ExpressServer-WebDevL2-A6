import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
	path: path.join(
		process.cwd(),
		process.env.NODE_ENV === "test" ? ".env.test" : ".env",
	),
	quiet: true,
});

const databaseUrl = process.env.DATABASE_URL
	? new URL(process.env.DATABASE_URL)
	: undefined;
if (process.env.NODE_ENV === "test") {
	if (
		process.env.DATABASE_SCHEMA !== "clashless_test" ||
		process.env.REDIS_KEY_PREFIX !== "clashless:test:"
	)
		throw new Error("Tests require isolated database schema and Redis prefix");
	databaseUrl?.searchParams.set("schema", "clashless_test");
}

const requiredEnv = (name: string): string => {
	const value = process.env[name];
	if (!value) throw new Error(`Missing environment variable: ${name}`);
	return value;
};
export default {
	// core
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	app_name: process.env.APP_NAME || "API Server",
	database_url: databaseUrl?.toString(),
	database_schema: databaseUrl?.searchParams.get("schema") || "public",
	database_pool_max: Number(process.env.DATABASE_POOL_MAX) || 10,
	server_url: requiredEnv("SERVER_URL"),
	frontend_url: process.env.FRONTEND_URL,
	university_email_domain: requiredEnv("UNIVERSITY_EMAIL_DOMAIN"),
	demo_password: requiredEnv("DEMO_PASSWORD"),

	// auth
	bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
	jwt_access_secret: requiredEnv("JWT_ACCESS_SECRET"),
	jwt_refresh_secret: requiredEnv("JWT_REFRESH_SECRET"),
	jwt_access_expires_in: requiredEnv("JWT_ACCESS_EXPIRES_IN"),
	jwt_refresh_expires_in: requiredEnv("JWT_REFRESH_EXPIRES_IN"),
	redis_user: requiredEnv("REDIS_USER"),
	redis_password: requiredEnv("REDIS_PASSWORD"),
	redis_host: requiredEnv("REDIS_HOST"),
	redis_port: requiredEnv("REDIS_PORT"),
	redis_key_prefix: process.env.REDIS_KEY_PREFIX || "clashless:",
	redis_tls: process.env.REDIS_TLS === "true",
	smtp_user: requiredEnv("SMTP_USER"),
	smtp_password: requiredEnv("SMTP_PASSWORD"),
	email_sender: requiredEnv("EMAIL_SENDER"),
	admin_name: requiredEnv("ADMIN_NAME"),
	admin_email: requiredEnv("ADMIN_EMAIL"),
	admin_password: requiredEnv("ADMIN_PASSWORD"),

	// google login
	google_client_id: requiredEnv("GOOGLE_CLIENT_ID"),

	// uploads
	cloudinary_cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"),
	cloudinary_api_key: requiredEnv("CLOUDINARY_API_KEY"),
	cloudinary_api_secret: requiredEnv("CLOUDINARY_API_SECRET"),

	// bkash
	bkash_base_url: requiredEnv("BKASH_BASE_URL"),
	bkash_username: requiredEnv("BKASH_USERNAME"),
	bkash_password: requiredEnv("BKASH_PASSWORD"),
	bkash_app_key: requiredEnv("BKASH_APP_KEY"),
	bkash_app_secret: requiredEnv("BKASH_APP_SECRET"),
};
