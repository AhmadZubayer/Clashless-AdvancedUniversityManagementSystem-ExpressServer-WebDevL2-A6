import { randomInt } from "node:crypto";

export function generatePassword() {
	const groups = ["abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789", "!@#$%&*"];
	const all = groups.join("");
	const chars = groups.map((group) => group[randomInt(group.length)]);
	while (chars.length < 12) chars.push(all[randomInt(all.length)]);
	for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
	return chars.join("");
}
