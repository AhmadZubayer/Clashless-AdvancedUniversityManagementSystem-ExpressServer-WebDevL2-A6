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
