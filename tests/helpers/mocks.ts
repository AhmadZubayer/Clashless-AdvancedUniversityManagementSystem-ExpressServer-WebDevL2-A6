import { vi } from "vitest";

const externalMocks = vi.hoisted(() => ({
	emails: [] as { to: string; templateData: Record<string, unknown> }[],
	googlePayload: { email: "", sub: "", name: "", email_verified: true },
	checkout: vi.fn(async () => ({
		providerTransactionId: "TEST-1",
		checkoutUrl: "https://sandbox.test/pay",
	})),
	refund: vi.fn(async () => ({
		providerRefundId: "REFUND-1",
		status: "succeeded",
	})),
	bkashRequest: vi.fn(),
}));

vi.mock("../../src/app/utils/sendEmail", () => ({
	sendEmail: vi.fn(async (input) => {
		externalMocks.emails.push(input);
	}),
}));
vi.mock("../../src/app/utils/uploadToCloudinary", () => ({
	uploadToCloudinary: vi.fn(async () => ({
		url: "https://sandbox.test/photo.png",
		publicId: "TEST-PHOTO",
	})),
	deleteFromCloudinary: vi.fn(),
}));
vi.mock("../../src/app/lib/googleAuth", () => ({
	googleClient: {
		verifyIdToken: vi.fn(async () => ({
			getPayload: () => externalMocks.googlePayload,
		})),
	},
}));
vi.mock("../../src/app/module/payment/providers/bkash/bkash.provider", () => ({
	bkashPaymentProvider: {
		createCheckoutSession: externalMocks.checkout,
		refundPayment: externalMocks.refund,
	},
}));
vi.mock("../../src/app/lib/bkash", () => ({
	bkashRequest: externalMocks.bkashRequest,
}));

export const lastOtpFor = (email: string) =>
	externalMocks.emails.findLast(
		(item) => item.to === email && item.templateData.otp,
	)?.templateData.otp;

export { externalMocks };
