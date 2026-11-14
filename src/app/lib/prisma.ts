import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const connectionString = config.database_url;

const adapter = new PrismaPg(
	{ connectionString },
	{ schema: config.database_schema },
);
const prisma = new PrismaClient({ adapter });

export { prisma };
