import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const userId = randomUUID();

try {
  const responses = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      fetch(`${baseUrl}/api/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          step: (index % 6) + 1,
          gender: "female",
          goal: "maintain",
          age: 30
        })
      })
    )
  );

  const failed = responses.filter((response) => !response.ok);
  if (failed.length > 0) {
    const messages = await Promise.all(failed.map((response) => response.text()));
    throw new Error(`Concurrent requests failed: ${messages.join(" | ")}`);
  }

  const records = await prisma.healthRecord.count({ where: { userId } });
  console.log(`records=${records}`);
  if (records !== 1) throw new Error(`Expected one health record, received ${records}`);
} finally {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
}
