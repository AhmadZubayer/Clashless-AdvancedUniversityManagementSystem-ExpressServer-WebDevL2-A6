export interface ITimeRange {
	startMinute: number;
	endMinute: number;
}

export const overlaps = (a: ITimeRange, b: ITimeRange) =>
	a.startMinute < b.endMinute && b.startMinute < a.endMinute;

export function minutesToTime(minutes: number) {
	if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440)
		throw new RangeError("Minutes must be an integer in 0..1439");
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string) {
	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
		throw new RangeError("Time must use HH:MM");
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

export const formatDhaka = (date: Date | string) =>
	new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Dhaka",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(date));
