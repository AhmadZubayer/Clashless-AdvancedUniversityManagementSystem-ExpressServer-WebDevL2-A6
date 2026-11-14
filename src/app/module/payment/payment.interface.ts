import type { Prisma } from "../../../generated/prisma/client";
import type {
	PaymentProvider,
	PaymentStatus,
} from "../../../generated/prisma/enums";

export interface ICreatePayment {
	amount: Prisma.Decimal;
	provider?: PaymentProvider;
}

export interface IAdminPaymentQuery {
	status?: PaymentStatus;
	from?: Date;
	to?: Date;
	batchId?: string;
	searchTerm?: string;
	page: number;
	limit: number;
	sortBy: "createdAt" | "amount";
	sortOrder: "asc" | "desc";
}

// Strategy pattern
export interface ICreateCheckoutPayload {
	registrationId: string;
	paymentId: string;
	amount: string;
	currency: string;
	serviceTitle: string;
	customerEmail: string;
}

export interface ICheckoutResult {
	providerTransactionId: string;
	checkoutUrl: string;
}

export interface ICompletePayment {
	paymentId: string;
	registrationId: string;
	provider: PaymentProvider;
	providerTransactionId: string;
	amount: string;
	currency: string;
}

export interface IClosePayment {
	paymentId: string;
	registrationId: string;
	provider: PaymentProvider;
	providerTransactionId: string;
	status: PaymentStatus;
}

export interface IRefundPayment {
	paymentId: string;
	providerTransactionId: string;
}

export interface IRefundResult {
	providerRefundId: string;
	status: string | null;
}

export interface IPaymentProvider {
	createCheckoutSession(
		payload: ICreateCheckoutPayload,
	): Promise<ICheckoutResult>;
	refundPayment(payload: IRefundPayment): Promise<IRefundResult>;
}
