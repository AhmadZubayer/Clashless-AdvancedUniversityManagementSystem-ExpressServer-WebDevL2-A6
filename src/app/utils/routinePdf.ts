import { generatePdf } from "./generatePdf";
import { minutesToTime } from "./time";

export interface IRoutinePdfEntry {
	roomId: string;
	room: { code: string };
	dayPattern: { days: string[] };
	timeSlot: { startMinute: number; endMinute: number };
	section: {
		sectionNo: number;
		faculty: { name: string } | null;
		offering: { course: { code: string } };
	};
}

export function routinePdf(
	title: string,
	entries: IRoutinePdfEntry[],
	master: boolean,
) {
	return generatePdf((pdf) => {
		const groups = new Map<string, IRoutinePdfEntry[]>();
		if (master)
			for (const entry of entries) {
				const rows = groups.get(entry.room.code) ?? [];
				rows.push(entry);
				groups.set(entry.room.code, rows);
			}
		else groups.set("Weekly routine", entries);
		if (!groups.size) groups.set("Weekly routine", []);
		let firstPage = true;
		for (const [label, rows] of [...groups].sort(([a], [b]) =>
			a.localeCompare(b),
		)) {
			if (!firstPage) pdf.addPage();
			firstPage = false;
			const days = ["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"];
			const left = pdf.page.margins.left;
			const width = pdf.page.width - left - pdf.page.margins.right;
			const timeWidth = 64;
			const cellWidth = (width - timeWidth) / days.length;
			const heading = () => {
				pdf
					.font("Helvetica-Bold")
					.fontSize(14)
					.text(title, left, 45, { width });
				pdf
					.font("Helvetica")
					.fontSize(10)
					.text(`${label} | Asia/Dhaka`, left, 66, { width });
				const top = 88;
				pdf.font("Helvetica-Bold").fontSize(8);
				pdf
					.rect(left, top, timeWidth, 24)
					.stroke()
					.text("Time", left + 4, top + 7, { width: timeWidth - 8 });
				days.forEach((day, index) => {
					const x = left + timeWidth + index * cellWidth;
					pdf
						.rect(x, top, cellWidth, 24)
						.stroke()
						.text(day, x + 4, top + 7, { width: cellWidth - 8 });
				});
				return top + 24;
			};
			let y = heading();
			const slots = [
				...new Map(
					rows.map((row) => [
						`${row.timeSlot.startMinute}:${row.timeSlot.endMinute}`,
						row.timeSlot,
					]),
				).values(),
			].sort(
				(a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
			);
			for (const slot of slots) {
				const cells = days.map((day) =>
					rows
						.filter(
							(row) =>
								row.timeSlot.startMinute === slot.startMinute &&
								row.timeSlot.endMinute === slot.endMinute &&
								row.dayPattern.days.includes(day),
						)
						.map(
							(row) =>
								`${row.section.offering.course.code} / ${row.section.sectionNo}\n${row.room.code}\n${row.section.faculty?.name ?? "TBA"}`,
						)
						.join("\n\n"),
				);
				pdf.font("Helvetica").fontSize(7);
				const height = Math.max(
					48,
					...cells.map(
						(text) =>
							pdf.heightOfString(text || " ", { width: cellWidth - 8 }) + 12,
					),
				);
				if (y + height > pdf.page.height - pdf.page.margins.bottom) {
					pdf.addPage();
					y = heading();
					pdf.font("Helvetica").fontSize(7);
				}
				pdf
					.rect(left, y, timeWidth, height)
					.stroke()
					.text(
						`${minutesToTime(slot.startMinute)}\n${minutesToTime(slot.endMinute)}`,
						left + 4,
						y + 6,
						{ width: timeWidth - 8 },
					);
				cells.forEach((text, index) => {
					const x = left + timeWidth + index * cellWidth;
					pdf.rect(x, y, cellWidth, height).stroke();
					if (text) pdf.text(text, x + 4, y + 6, { width: cellWidth - 8 });
				});
				y += height;
			}
			if (!rows.length)
				pdf
					.font("Helvetica")
					.fontSize(11)
					.text("No scheduled classes.", left, y + 14);
		}
	});
}
