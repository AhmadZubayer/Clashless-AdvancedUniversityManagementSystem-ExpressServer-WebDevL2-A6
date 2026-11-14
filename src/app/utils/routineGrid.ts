import { minutesToTime } from "./time";

interface IGridEntry {
	dayPattern: { days: string[] };
	timeSlot: { startMinute: number };
}
export function routineGrid<T extends IGridEntry>(entries: T[]) {
	const grid: Record<string, Record<string, T[]>> = {};
	for (const entry of [...entries].sort(
		(a, b) => a.timeSlot.startMinute - b.timeSlot.startMinute,
	)) {
		for (const day of entry.dayPattern.days) {
			const times = grid[day] ?? {};
			const time = minutesToTime(entry.timeSlot.startMinute);
			times[time] ??= [];
			times[time].push(entry);
			grid[day] = times;
		}
	}
	return grid;
}
