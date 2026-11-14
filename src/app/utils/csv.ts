import { AppError } from "./AppError";

export interface ICsvRow {
	row: number;
	values: Record<string, string>;
	error?: string;
}

export function parseCsv(input: string): ICsvRow[] {
	const text = input.replace(/^\uFEFF/, "");
	const records: { row: number; cells: string[] }[] = [];
	let cells: string[] = [];
	let field = "";
	let quoted = false;
	let afterQuote = false;
	let line = 1;
	let startLine = 1;
	const finish = () => {
		cells.push(field);
		if (cells.some((cell) => cell.trim()))
			records.push({ row: startLine, cells });
		cells = [];
		field = "";
		afterQuote = false;
	};
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				quoted = false;
				afterQuote = true;
			} else {
				field += char;
				if (char === "\n") line++;
			}
		} else if (char === '"' && !field && !afterQuote) quoted = true;
		else if (char === ",") {
			cells.push(field);
			field = "";
			afterQuote = false;
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") i++;
			finish();
			line++;
			startLine = line;
		} else if (char === '"' || (afterQuote && char.trim()))
			throw new AppError(400, `Malformed CSV at row ${line}`);
		else if (!afterQuote) field += char;
	}
	if (quoted)
		throw new AppError(400, "CSV contains an unterminated quoted field");
	if (field || cells.length) finish();
	const header = records.shift()?.cells.map((cell) => cell.trim());
	if (
		!header?.length ||
		new Set(header).size !== header.length ||
		header.some((cell) => !cell)
	)
		throw new AppError(400, "CSV needs unique nonempty column headers");
	return records.map(({ row, cells: values }) => ({
		row,
		values: Object.fromEntries(
			header.map((name, i) => [name, values[i] ?? ""]),
		),
		...(values.length === header.length
			? {}
			: { error: "Column count does not match header" }),
	}));
}
