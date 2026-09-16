import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const userId = randomUUID();

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { status: response.status, body };
}

function jsonPost(body) {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const answers = {
    userId,
    step: 6,
    gender: "female",
    goal: "lose",
    age: 30,
    heightCm: 165,
    weightKg: 60,
    targetWeightKg: 55,
    activity: "moderate"
  };

  const saved = await request("/api/progress", jsonPost(answers));
  assert(saved.status === 200 && saved.body.record.targetWeightKg === 55, "Progress save failed");
  console.log(`progress-save status=${saved.status} targetWeightKg=${saved.body.record.targetWeightKg}`);

  const restored = await request(`/api/progress?userId=${userId}`);
  assert(restored.status === 200 && restored.body.record.step === 6 && restored.body.record.targetWeightKg === 55, "Progress restore failed");
  console.log(`progress-restore status=${restored.status} step=${restored.body.record.step} targetWeightKg=${restored.body.record.targetWeightKg}`);

  const assessment = await request("/api/assessment", jsonPost(answers));
  assert(assessment.status === 200 && assessment.body.recordId, "Assessment submission failed");
  console.log(`assessment status=${assessment.status} recordId=${assessment.body.recordId}`);

  const freeResult = await request(`/api/result?userId=${userId}`);
  assert(freeResult.status === 200 && freeResult.body.weeklyProjection === null, "Free result exposed projection");
  assert(freeResult.body.lockedFields.includes("weeklyProjection"), "Projection was not marked locked");
  console.log(`free-result status=${freeResult.status} weeklyProjection=${freeResult.body.weeklyProjection} lockedFields=${freeResult.body.lockedFields.join(",")}`);
  console.log(`profile bodyType=${freeResult.body.bodyType} lifestyle=${freeResult.body.lifestyle} activityLevel=${freeResult.body.activityLevel} metabolism=${freeResult.body.metabolism}`);

  const payment = await request("/api/pay", jsonPost({ userId, sessionId: `smoke_${randomUUID()}` }));
  assert(payment.status === 200 && payment.body.paid === true, "Payment failed");
  console.log(`pay status=${payment.status} paid=${payment.body.paid}`);

  const memberResult = await request(`/api/result?userId=${userId}`);
  assert(memberResult.status === 200 && memberResult.body.weeklyProjection?.length === 4, "Member projection is incomplete");
  console.log(`member-result status=${memberResult.status} weeklyProjection=${JSON.stringify(memberResult.body.weeklyProjection)}`);

  const invalidCases = [
    ["injection", "/api/progress", jsonPost({ ...answers, age: "30 OR 1=1" })],
    ["out-of-range", "/api/progress", jsonPost({ ...answers, targetWeightKg: 251 })],
    ["invalid-uuid", "/api/progress?userId=00000000-0000-0000-0000-notauuid"],
    ["invalid-step", "/api/progress", jsonPost({ ...answers, step: 7 })]
  ];

  for (const [name, path, init] of invalidCases) {
    const result = await request(path, init);
    assert(result.status === 400, `${name} returned ${result.status}, expected 400`);
    console.log(`invalid-${name} status=${result.status}`);
  }
} finally {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.$disconnect();
}
