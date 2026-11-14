import { z } from "zod";

export const offsetDateSchema = z
	.string()
	.trim()
	.pipe(z.iso.datetime({ offset: true }))
	.transform((value) => new Date(value));
