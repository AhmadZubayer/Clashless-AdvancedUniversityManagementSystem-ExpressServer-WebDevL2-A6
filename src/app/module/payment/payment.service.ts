import httpStatus from "http-status";
import {
	RegistrationStatus,
	PaymentProvider,
	PaymentStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICheckoutResult,
	ICreatePayment,
	ICompletePayment,
	IClosePayment,
} from "./payment.interface";
import { getPaymentProvider } from "./providers/paymentProvider.factory";
import { Prisma } from "../../../generated/prisma/client";

const getPayableRegistrationFromDB = async (
	customerId: string,
	payload: ICreatePayment,
) => {
	const registration = await prisma.semesterRegistration.findFirst({
		where: {
			id: payload.registrationId,
			student: { userId: customerId },
		},
		select: {
			id: true,
			status: true,
			totalFee: true,
			student: {
				select: {
					email: true,
				},
			},
			semester: {
				select: {
					name: true,
				},
			},
			payments: {
				where: {
					status: PaymentStatus.COMPLETED,
				},
				select: {
					id: true,
				},
			},
		},
	});

	if (!registration) {
		throw new AppError(httpStatus.NOT_FOUND, "Registration not found");
	}

	if (registration.payments.length > 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This registration has already been paid",
		);
	}

	if (registration.status !== RegistrationStatus.ACTIVE) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Only accepted registrations can be paid",
		);
	}

	if (registration.totalFee.lte(0)) {
		throw new AppError(httpStatus.CONFLICT, "Registration price is invalid");
	}

	return registration;
};

const createPaymentIntoDB = async (
	customerId: string,
	payload: ICreatePayment,
) => {
	const registration = await getPayableRegistrationFromDB(customerId, payload);
	const selectedProvider = payload.provider ?? PaymentProvider.BKASH;
	const provider = getPaymentProvider(selectedProvider);

	let payment: Awaited<ReturnType<typeof prisma.payment.create>>;

	try {
		payment = await prisma.$transaction(
			async (transaction) => {
				const acceptedRegistration =
					await transaction.semesterRegistration.findFirst({
						where: {
							id: registration.id,
							status: RegistrationStatus.ACTIVE,
						},
						select: {
							id: true,
						},
					});

				if (!acceptedRegistration) {
					throw new AppError(
						httpStatus.CONFLICT,
						"Registration is no longer accepted",
					);
				}

				const pendingPayment = await transaction.payment.findFirst({
					where: {
						registrationId: registration.id,
						status: PaymentStatus.PENDING,
					},
					select: {
						id: true,
					},
				});

				if (pendingPayment) {
					throw new AppError(
						httpStatus.CONFLICT,
						"A payment is already in progress for this registration",
					);
				}

				return transaction.payment.create({
					data: {
						registrationId: registration.id,
						amount: registration.totalFee,
						provider: selectedProvider,
						status: PaymentStatus.PENDING,
					},
				});
			},
			{
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
			},
		);
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2034"
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Payment request conflicted. Please try again",
			);
		}

		throw error;
	}

	let checkout: ICheckoutResult;

	try {
		checkout = await provider.createCheckoutSession({
			registrationId: registration.id,
			paymentId: payment.id,
			amount: registration.totalFee.toString(),
			currency: "bdt",
			serviceTitle: registration.semester.name,
			customerEmail: registration.student.email,
		});
	} catch (error) {
		await prisma.payment.update({
			where: {
				id: payment.id,
			},
			data: {
				status: PaymentStatus.FAILED,
			},
		});

		throw error;
	}

	await prisma.payment.update({
		where: {
			id: payment.id,
		},
		data: {
			providerTransactionId: checkout.providerTransactionId,
		},
	});

	return {
		paymentId: payment.id,
		checkoutUrl: checkout.checkoutUrl,
	};
};

const completePaymentIntoDB = async (payload: ICompletePayment) => {
	if (payload.currency.toLowerCase() !== "bdt") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment currency does not match",
		);
	}

	return prisma.$transaction(async (transaction) => {
		const payment = await transaction.payment.findUnique({
			where: {
				id: payload.paymentId,
			},
			select: {
				id: true,
				registrationId: true,
				provider: true,
				providerTransactionId: true,
				amount: true,
				status: true,
				registration: {
					select: {
						status: true,
					},
				},
			},
		});

		if (
			!payment ||
			payment.registrationId !== payload.registrationId ||
			payment.provider !== payload.provider
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Payment details do not match",
			);
		}

		if (!payment.amount.equals(payload.amount)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Payment amount does not match",
			);
		}

		if (
			payment.providerTransactionId &&
			payment.providerTransactionId !== payload.providerTransactionId
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Payment session does not match",
			);
		}

		if (
			payment.status === PaymentStatus.COMPLETED &&
			payment.registration.status === RegistrationStatus.ACTIVE
		) {
			return transaction.payment.findUniqueOrThrow({
				where: {
					id: payment.id,
				},
			});
		}

		if (
			payment.status !== PaymentStatus.PENDING ||
			payment.registration.status !== RegistrationStatus.ACTIVE
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This registration cannot be marked as paid",
			);
		}

		const updatedPayment = await transaction.payment.updateMany({
			where: {
				id: payment.id,
				status: PaymentStatus.PENDING,
				OR: [
					{ providerTransactionId: null },
					{ providerTransactionId: payload.providerTransactionId },
				],
			},
			data: {
				status: PaymentStatus.COMPLETED,
				providerTransactionId: payload.providerTransactionId,
				paidAt: new Date(),
			},
		});

		if (updatedPayment.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Payment status changed. Please try again",
			);
		}

		const updatedRegistration =
			await transaction.semesterRegistration.updateMany({
				where: {
					id: payment.registrationId,
					status: RegistrationStatus.ACTIVE,
				},
				data: {
					status: RegistrationStatus.ACTIVE,
				},
			});

		if (updatedRegistration.count === 0) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Registration status changed. Please try again",
			);
		}

		return transaction.payment.findUniqueOrThrow({
			where: {
				id: payment.id,
			},
		});
	});
};

const closePendingPaymentIntoDB = async (payload: IClosePayment) => {
	if (
		payload.status !== PaymentStatus.FAILED &&
		payload.status !== PaymentStatus.CANCELLED
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment status");
	}

	const payment = await prisma.payment.findUnique({
		where: {
			id: payload.paymentId,
		},
		select: {
			id: true,
			registrationId: true,
			provider: true,
			providerTransactionId: true,
			status: true,
		},
	});

	if (
		!payment ||
		payment.registrationId !== payload.registrationId ||
		payment.provider !== payload.provider ||
		(payment.providerTransactionId &&
			payment.providerTransactionId !== payload.providerTransactionId)
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment details do not match");
	}

	if (payment.status !== PaymentStatus.PENDING) {
		return payment;
	}

	const updatedPayment = await prisma.payment.updateMany({
		where: {
			id: payment.id,
			status: PaymentStatus.PENDING,
			OR: [
				{ providerTransactionId: null },
				{ providerTransactionId: payload.providerTransactionId },
			],
		},
		data: {
			status: payload.status,
			providerTransactionId: payload.providerTransactionId,
		},
	});

	if (updatedPayment.count === 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Payment status changed. Please try again",
		);
	}

	return prisma.payment.findUniqueOrThrow({
		where: {
			id: payment.id,
		},
	});
};

const refundCancelledRegistrationPaymentIntoDB = async (
	payload: ICompletePayment,
) => {
	if (payload.currency.toLowerCase() !== "bdt") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment currency does not match",
		);
	}

	const payment = await prisma.payment.findUnique({
		where: {
			id: payload.paymentId,
		},
		select: {
			id: true,
			registrationId: true,
			provider: true,
			providerTransactionId: true,
			amount: true,
			status: true,
			paidAt: true,
			registration: {
				select: {
					status: true,
				},
			},
		},
	});

	if (
		!payment ||
		payment.registrationId !== payload.registrationId ||
		payment.provider !== payload.provider ||
		(payment.providerTransactionId &&
			payment.providerTransactionId !== payload.providerTransactionId)
	) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment details do not match");
	}

	if (!payment.amount.equals(payload.amount)) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment amount does not match");
	}

	if (payment.registration.status !== RegistrationStatus.DISCARDED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This registration has not been cancelled",
		);
	}

	if (
		payment.status === PaymentStatus.REFUND_PENDING ||
		payment.status === PaymentStatus.REFUNDED
	) {
		return prisma.payment.findUniqueOrThrow({
			where: {
				id: payment.id,
			},
		});
	}

	const provider = getPaymentProvider(payment.provider);

	const refund = await provider.refundPayment({
		paymentId: payment.id,
		providerTransactionId: payload.providerTransactionId,
	});

	const refundStatus =
		refund.status === "succeeded"
			? PaymentStatus.REFUNDED
			: refund.status === "failed" || refund.status === "canceled"
				? PaymentStatus.REFUND_FAILED
				: PaymentStatus.REFUND_PENDING;

	const updatedPayment = await prisma.payment.updateMany({
		where: {
			id: payment.id,
			registration: {
				status: RegistrationStatus.DISCARDED,
			},
			status: {
				in: [
					PaymentStatus.PENDING,
					PaymentStatus.COMPLETED,
					PaymentStatus.FAILED,
					PaymentStatus.CANCELLED,
				],
			},
			providerRefundId: null,
			OR: [
				{ providerTransactionId: null },
				{ providerTransactionId: payload.providerTransactionId },
			],
		},
		data: {
			status: refundStatus,
			providerTransactionId: payload.providerTransactionId,
			providerRefundId: refund.providerRefundId,
			paidAt: payment.paidAt ?? new Date(),
		},
	});

	if (updatedPayment.count === 0) {
		const currentPayment = await prisma.payment.findUniqueOrThrow({
			where: {
				id: payment.id,
			},
		});

		if (
			currentPayment.status === PaymentStatus.REFUND_PENDING ||
			currentPayment.status === PaymentStatus.REFUND_FAILED ||
			currentPayment.status === PaymentStatus.REFUNDED
		) {
			return currentPayment;
		}

		throw new AppError(
			httpStatus.CONFLICT,
			"Payment status changed. Please try again",
		);
	}

	return prisma.payment.findUniqueOrThrow({
		where: {
			id: payment.id,
		},
	});
};

const updateRefundStatusIntoDB = async (
	provider: PaymentProvider,
	providerRefundId: string,
	status: string | null,
): Promise<void> => {
	const refundStatus =
		status === "succeeded"
			? PaymentStatus.REFUNDED
			: status === "failed" || status === "canceled"
				? PaymentStatus.REFUND_FAILED
				: null;

	if (!refundStatus) {
		return;
	}

	const updatedPayment = await prisma.payment.updateMany({
		where: {
			provider,
			providerRefundId,
			status: {
				in: [
					PaymentStatus.REFUND_PENDING,
					PaymentStatus.REFUND_FAILED,
					PaymentStatus.REFUNDED,
				],
			},
		},
		data: {
			status: refundStatus,
		},
	});

	if (updatedPayment.count === 0) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Payment for this refund was not found",
		);
	}
};

const getMyPaymentsFromDB = async (customerId: string) => {
	return prisma.payment.findMany({
		where: {
			registration: {
				student: { userId: customerId },
			},
		},
		select: {
			id: true,
			transactionId: true,
			registrationId: true,
			amount: true,
			provider: true,
			status: true,
			paidAt: true,
			createdAt: true,
			registration: {
				select: {
					status: true,
					semester: {
						select: {
							name: true,
						},
					},
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});
};

const getPaymentByIdFromDB = async (id: string, customerId: string) => {
	const payment = await prisma.payment.findFirst({
		where: {
			id,
			registration: {
				student: { userId: customerId },
			},
		},
		select: {
			id: true,
			transactionId: true,
			registrationId: true,
			amount: true,
			method: true,
			provider: true,
			status: true,
			paidAt: true,
			createdAt: true,
			updatedAt: true,
			registration: {
				select: {
					status: true,

					semester: {
						select: {
							name: true,
						},
					},
				},
			},
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	return payment;
};

const refundCancelledPaidRegistrationIntoDB = async (
	registrationId: string,
) => {
	const payment = await prisma.payment.findFirst({
		where: {
			registrationId,
			status: {
				in: [
					PaymentStatus.COMPLETED,
					PaymentStatus.REFUND_PENDING,
					PaymentStatus.REFUNDED,
				],
			},
		},
		select: {
			id: true,
			provider: true,
			providerTransactionId: true,
			amount: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	if (!payment?.providerTransactionId) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Paid registration payment was not found",
		);
	}

	return refundCancelledRegistrationPaymentIntoDB({
		paymentId: payment.id,
		registrationId,
		provider: payment.provider,
		providerTransactionId: payment.providerTransactionId,
		amount: payment.amount.toString(),
		currency: "bdt",
	});
};

export const paymentService = {
	getPayableRegistrationFromDB,
	createPaymentIntoDB,
	completePaymentIntoDB,
	closePendingPaymentIntoDB,
	refundCancelledRegistrationPaymentIntoDB,
	updateRefundStatusIntoDB,
	getMyPaymentsFromDB,
	getPaymentByIdFromDB,
	refundCancelledPaidRegistrationIntoDB,
};
