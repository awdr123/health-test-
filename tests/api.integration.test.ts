// @vitest-environment node

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "./db.setup";
import { testPrisma } from "./prisma.mock";
import { GET as getProgress, POST as postProgress } from "@/app/api/progress/route";
import { POST as postAssessment } from "@/app/api/assessment/route";
import { GET as getResult } from "@/app/api/result/route";
import { POST as postPay } from "@/app/api/pay/route";

const origin = "http://localhost";
let userIds: string[] = [];

beforeEach(() => {
  userIds = [];
});

afterEach(async () => {
  if (userIds.length > 0) {
    await testPrisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

function newUserId() {
  const userId = randomUUID();
  userIds.push(userId);
  return userId;
}

function postRequest(path: string, body: unknown) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function assessmentAnswers(userId: string) {
  return {
    userId,
    step: 6,
    gender: "female",
    goal: "lose",
    age: 30,
    heightCm: 165,
    weightKg: 60,
    targetWeightKg: 55,
    activity: "moderate"
  } as const;
}

describe("progress persistence", () => {
  it("restores a partially saved assessment after interruption", async () => {
    const userId = newUserId();
    const saved = await postProgress(postRequest("/api/progress", {
      userId,
      step: 3,
      gender: "female",
      goal: "lose",
      age: 30,
      targetWeightKg: 55
    }));
    expect(saved.status).toBe(200);

    const restored = await getProgress(new Request(`${origin}/api/progress?userId=${userId}`));
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({
      record: { userId, step: 3, age: 30, targetWeightKg: 55 }
    });
  });

  it("restores the latest write when steps arrive out of order", async () => {
    const userId = newUserId();
    expect((await postProgress(postRequest("/api/progress", { userId, step: 5, weightKg: 60 }))).status).toBe(200);
    expect((await postProgress(postRequest("/api/progress", { userId, step: 2, age: 31 }))).status).toBe(200);

    const restored = await getProgress(new Request(`${origin}/api/progress?userId=${userId}`));
    const body = await restored.json();
    expect(body.record).toMatchObject({ step: 2, age: 31, weightKg: 60 });
  });

  it("keeps one record when the same step is submitted twice", async () => {
    const userId = newUserId();
    await postProgress(postRequest("/api/progress", { userId, step: 2, goal: "lose" }));
    await postProgress(postRequest("/api/progress", { userId, step: 2, goal: "maintain" }));

    await expect(testPrisma.healthRecord.count({ where: { userId } })).resolves.toBe(1);
    await expect(testPrisma.healthRecord.findUnique({ where: { userId } })).resolves.toMatchObject({ goal: "maintain" });
  });

  it("keeps one record across ten concurrent progress updates", async () => {
    const userId = newUserId();
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        postProgress(postRequest("/api/progress", { userId, step: index % 7, age: 30 + index }))
      )
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    await expect(testPrisma.healthRecord.count({ where: { userId } })).resolves.toBe(1);
  });

  it("returns 404 when an incomplete user requests results", async () => {
    const userId = newUserId();
    await postProgress(postRequest("/api/progress", { userId, step: 2, age: 30 }));

    const response = await getResult(new Request(`${origin}/api/result?userId=${userId}`));
    expect(response.status).toBe(404);
  });
});

describe("subscription access", () => {
  it("redacts premium fields, activates a subscription, then returns the complete result", async () => {
    const userId = newUserId();
    const assessment = await postAssessment(postRequest("/api/assessment", assessmentAnswers(userId)));
    expect(assessment.status).toBe(200);

    const freeResponse = await getResult(new Request(`${origin}/api/result?userId=${userId}`));
    const freeText = await freeResponse.text();
    const free = JSON.parse(freeText);
    expect(freeResponse.status).toBe(200);
    for (const field of ["dailyCalories", "targetDate", "plan", "weeklyProjection"]) {
      expect(free[field]).toBeNull();
      expect(freeText).not.toMatch(new RegExp(`"${field}":(?!null)`));
    }
    expect(free.lockedFields).toEqual(expect.arrayContaining(["dailyCalories", "targetDate", "plan", "weeklyProjection"]));
    expect(free).toMatchObject({
      bodyType: "Mesomorph",
      lifestyle: "Active",
      activityLevel: "Intermediate",
      metabolism: "Slow"
    });

    const payment = await postPay(postRequest("/api/pay", { userId, sessionId: `test_${randomUUID()}` }));
    expect(payment.status).toBe(200);
    await expect(testPrisma.subscription.findUnique({ where: { userId } })).resolves.toMatchObject({ status: "active" });

    const memberResponse = await getResult(new Request(`${origin}/api/result?userId=${userId}`));
    const member = await memberResponse.json();
    expect(memberResponse.status).toBe(200);
    expect(member).toMatchObject({ isMember: true, dailyCalories: expect.any(Number), targetDate: expect.any(String) });
    expect(member.plan).toHaveLength(3);
    expect(member.weeklyProjection).toEqual([
      { week: 1, weight: 59.25 },
      { week: 2, weight: 58.5 },
      { week: 3, weight: 57.75 },
      { week: 4, weight: 57 }
    ]);
  });

  it("returns 404 when payment is attempted for an unknown user", async () => {
    const response = await postPay(postRequest("/api/pay", {
      userId: newUserId(),
      sessionId: `test_${randomUUID()}`
    }));
    expect(response.status).toBe(404);
  });
});

describe("API validation", () => {
  it("returns 400 for a malformed GET userId", async () => {
    const response = await getProgress(new Request(`${origin}/api/progress?userId=00000000-0000-0000-0000-notauuid`));
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid progress and assessment bodies", async () => {
    const userId = newUserId();
    const invalidProgress = await postProgress(postRequest("/api/progress", { userId, step: 7, age: "30 OR 1=1" }));
    const invalidAssessment = await postAssessment(postRequest("/api/assessment", {
      ...assessmentAnswers(userId),
      targetWeightKg: 251
    }));
    expect(invalidProgress.status).toBe(400);
    expect(invalidAssessment.status).toBe(400);
  });

  it("returns 400 for an invalid payment body", async () => {
    const response = await postPay(postRequest("/api/pay", { userId: "not-a-uuid", sessionId: "short" }));
    expect(response.status).toBe(400);
  });
});
