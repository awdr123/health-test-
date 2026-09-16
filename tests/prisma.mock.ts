import { PrismaClient } from "@prisma/test-client";

const globalForTestPrisma = globalThis as unknown as { testPrisma?: PrismaClient };

export const prisma = globalForTestPrisma.testPrisma ?? new PrismaClient();
export const testPrisma = prisma;

if (!globalForTestPrisma.testPrisma) {
  prisma.$use(async (params, next) => {
    if (params.model === "HealthRecord") {
      const writes = params.action === "upsert"
        ? [params.args.create, params.args.update]
        : [params.args.data];
      for (const data of writes) {
        if (data && data.weeklyProjection !== undefined && data.weeklyProjection !== null && typeof data.weeklyProjection !== "string") {
          data.weeklyProjection = JSON.stringify(data.weeklyProjection);
        }
      }
    }

    const result = await next(params);
    if (params.model !== "HealthRecord") return result;

    const parseProjection = (record: Record<string, unknown> | null) => {
      if (record && typeof record.weeklyProjection === "string") {
        record.weeklyProjection = JSON.parse(record.weeklyProjection);
      }
      return record;
    };
    return Array.isArray(result) ? result.map(parseProjection) : parseProjection(result);
  });
}

globalForTestPrisma.testPrisma = prisma;
