import { describe, expect, it } from "vitest";
import { completeSchema, progressSchema } from "@/lib/validation";

const userId = "9b4fb298-f628-4e21-a05f-87efce748d26";

describe("assessment validation", () => {
  const complete = {
    userId,
    step: 6,
    gender: "female" as const,
    goal: "lose" as const,
    age: 30,
    heightCm: 165,
    weightKg: 60,
    targetWeightKg: 55,
    activity: "moderate" as const
  };

  it("allows a partial progress save", () => {
    expect(progressSchema.parse({ userId, step: 2, gender: "female", goal: "lose" })).toMatchObject({ step: 2 });
  });

  it("rejects a complete submission with missing fields", () => {
    expect(completeSchema.safeParse({ userId, step: 6, gender: "male" }).success).toBe(false);
  });

  it("requires a target weight between 30 and 250 kg", () => {
    const { targetWeightKg: _targetWeightKg, ...missingTarget } = complete;
    expect(completeSchema.safeParse(missingTarget).success).toBe(false);
    expect(completeSchema.safeParse(complete).success).toBe(true);
    expect(completeSchema.safeParse({ ...complete, targetWeightKg: 29 }).success).toBe(false);
    expect(completeSchema.safeParse({ ...complete, targetWeightKg: 251 }).success).toBe(false);
    expect(completeSchema.safeParse({ ...complete, targetWeightKg: "55 OR 1=1" }).success).toBe(false);
  });

  it.each(["age", "heightCm", "weightKg", "targetWeightKg"] as const)("rejects string injection in %s", (field) => {
    expect(completeSchema.safeParse({ ...complete, [field]: "25 OR 1=1" }).success).toBe(false);
  });

  it.each([
    ["gender", "unknown"],
    ["goal", "bulk-forever"],
    ["activity", "extreme"]
  ] as const)("rejects unsupported %s enum values", (field, value) => {
    expect(progressSchema.safeParse({ userId, step: 1, [field]: value }).success).toBe(false);
  });
});
