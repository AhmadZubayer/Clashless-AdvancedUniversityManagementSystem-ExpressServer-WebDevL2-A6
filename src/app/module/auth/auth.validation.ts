import z from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password Must Minimum 8 Characters Long.")
	.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
	.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
	.regex(/[0-9]/, "Password must contain atleast 1 Number")
	.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character");

const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email("Invalid email address"));

const loginUserSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "Password is required"),
});

const requestActivationSchema = z.object({ email: emailSchema });
const activateSchema = z.object({
	email: emailSchema,
	otp: z
		.string()
		.trim()
		.regex(/^\d{6}$/),
	password: passwordSchema,
});

const googleLoginSchema = z.object({
	idToken: z.string().trim().min(1, "Google ID token is required"),
});

const forgotPasswordSchema = z.object({
	email: emailSchema,
});

const resetPasswordSchema = z.object({
	email: emailSchema,
	newPassword: passwordSchema,
	otp: z.string().length(6, "OTP must be 6 digits"),
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: passwordSchema,
});

export const authValidation = {
	requestActivationSchema,
	activateSchema,

	loginUserSchema,
	googleLoginSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	changePasswordSchema,
};
