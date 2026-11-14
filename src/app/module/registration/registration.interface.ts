export interface IRegistrationSectionParams {
	sectionId: string;
}
export type TRegistrationBypass =
	| "WINDOW"
	| "CREDIT_LIMIT"
	| "PREREQUISITE"
	| "TIME_CLASH"
	| "CAPACITY";
export interface IRegistrationCatalogQuery {
	page: number;
	limit: number;
	sortBy: "createdAt" | "code" | "title";
	sortOrder: "asc" | "desc";
	searchTerm?: string;
}
export interface IManualRegistration {
	reason: string;
	bypass: TRegistrationBypass[];
}
export interface IAdminRegistrationQuery {
	semesterId: string;
	batchId?: string;
	status?: "ACTIVE" | "DISCARDED";
	paymentStatus?: "UNPAID" | "MINIMUM_PAID" | "FULLY_PAID";
	atRisk: boolean;
	searchTerm?: string;
	page: number;
	limit: number;
	sortBy: "createdAt" | "paymentDeadline";
	sortOrder: "asc" | "desc";
}
