export interface IExamSlotInput {
	date: string;
	startMinute: number;
	endMinute: number;
}

export interface ICreateExamSlots {
	semesterId: string;
	slots: IExamSlotInput[];
}
