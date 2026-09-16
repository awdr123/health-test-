import { describe, expect, it } from "vitest";
import { calculateHealth } from "@/lib/health";
import type { QuizInput } from "@/lib/validation";

const base: QuizInput = {
  userId: "9b4fb298-f628-4e21-a05f-87efce748d26",
  step: 6,
  gender: "female" as const,
  goal: "maintain" as const,
  age: 30,
  heightCm: 165,
  weightKg: 60,
  targetWeightKg: 55,
  activity: "moderate" as const
};

const now = new Date("2026-09-16T00:00:00Z");
const assess = (input: QuizInput = base) => calculateHealth(input, now);

describe("calculateHealth", () => {
  it("calculates BMI and rounds calories to a useful increment", () => {
    const result = assess();
    expect(result.bmi).toBe(22);
    expect(result.dailyCalories).toBe(2050);
  });

  it("applies a lower target for weight loss", () => {
    const maintain = assess();
    const lose = assess({ ...base, goal: "lose" });
    expect(maintain.dailyCalories - lose.dailyCalories).toBe(400);
  });

  it("sets a four-week milestone for maintenance", () => {
    expect(assess().targetDate.toISOString().slice(0, 10)).toBe("2026-10-14");
  });

  it("projects a 5 kg loss at 0.75 kg per week for at most four weeks", () => {
    expect(assess().weeklyProjection).toEqual([
      { week: 1, weight: 59.25 },
      { week: 2, weight: 58.5 },
      { week: 3, weight: 57.75 },
      { week: 4, weight: 57 }
    ]);
  });

  it("stops the projection when a 1 kg target is reached in week two", () => {
    expect(assess({ ...base, targetWeightKg: 59 }).weeklyProjection).toEqual([
      { week: 1, weight: 59.25 },
      { week: 2, weight: 59 }
    ]);
  });

  it("returns a reason instead of a curve when the target is not lower", () => {
    const result = assess({ ...base, targetWeightKg: 60 });
    expect(result.weeklyProjection).toBeNull();
    expect(result.projectionReason).toContain("target below the current weight");
  });

  it.each([
    [{ ...base, heightCm: 0 }, "Height"],
    [{ ...base, heightCm: 240 }, "Height"],
    [{ ...base, weightKg: -10 }, "Weight"],
    [{ ...base, weightKg: Number.NaN }, "Weight"]
  ])("rejects unsafe body measurements", (input, field) => {
    expect(() => assess(input)).toThrow(field);
  });

  it.each([
    [{ ...base, targetWeightKg: undefined }, "Target weight"],
    [{ ...base, targetWeightKg: 29 }, "Target weight"],
    [{ ...base, targetWeightKg: Number.NaN }, "Target weight"],
    [{ ...base, targetWeightKg: 120 }, "within 50 kg"]
  ])("rejects an invalid target weight", (input, message) => {
    expect(() => assess(input as unknown as QuizInput)).toThrow(message);
  });

  it.each([
    [45, "Ectomorph"],
    [60, "Mesomorph"],
    [80, "Endomorph"]
  ])("maps BMI bands to body type", (weightKg, bodyType) => {
    expect(assess({ ...base, weightKg, targetWeightKg: 40 }).bodyType).toBe(bodyType);
  });

  it.each([
    ["low", "lose", "Beginner", "Sedentary", "Slow"],
    ["light", "maintain", "Intermediate", "Lightly Active", "Balanced"],
    ["moderate", "maintain", "Intermediate", "Active", "Balanced"],
    ["high", "gain", "Advanced", "Active", "Fast"]
  ] as const)("maps activity and goal to the remaining profile", (activity, goal, activityLevel, lifestyle, metabolism) => {
    const result = assess({ ...base, activity, goal });
    expect(result).toMatchObject({ activityLevel, lifestyle, metabolism });
  });
});
