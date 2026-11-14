import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import config from "../config";

const connectionString = config.database_url;

const adapter = new PrismaPg(
	{ connectionString, max: config.database_pool_max },
	{ schema: config.database_schema },
);
const prisma = new PrismaClient({ adapter });

export { prisma };
