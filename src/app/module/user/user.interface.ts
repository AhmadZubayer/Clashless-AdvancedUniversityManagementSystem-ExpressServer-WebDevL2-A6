export interface IUpdateProfile {
	contactNumber?: string;
	personalEmail?: string;
}
export interface ICreateAdmin {
	role: "ADMIN" | "SUPER_ADMIN";
	name: string;
	email: string;
	personalEmail: string;
}
export interface ICreateFaculty {
	name: string;
	email: string;
	personalEmail: string;
	departmentId: string;
	designation: string;
	maxCreditLoad: number;
}
export interface ICreateStudent {
	universityId: string;
	name: string;
	email: string;
	programId: string;
	batchId: string;
	personalEmail?: string;
	contactNumber?: string;
}
export interface IUserQuery {
	page: number;
	limit: number;
	sortBy: "createdAt" | "name" | "email";
	sortOrder: "asc" | "desc";
	searchTerm?: string;
	role?: "SUPER_ADMIN" | "ADMIN" | "FACULTY" | "STUDENT";
	status?: "ACTIVE" | "BLOCKED" | "DELETED";
	departmentId?: string;
	programId?: string;
	batchId?: string;
}
