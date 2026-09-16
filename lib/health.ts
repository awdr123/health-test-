import type { QuizInput } from "./validation";

export type WeeklyProjectionPoint = { week: number; weight: number };

export type WeeklyProjectionResult =
  | { weeklyProjection: WeeklyProjectionPoint[]; projectionReason: null }
  | { weeklyProjection: null; projectionReason: string };

export type HealthProfile = {
  bodyType: "Ectomorph" | "Mesomorph" | "Endomorph";
  lifestyle: "Sedentary" | "Lightly Active" | "Active";
  activityLevel: "Beginner" | "Intermediate" | "Advanced";
  metabolism: "Slow" | "Balanced" | "Fast";
};

export type HealthAssessment = HealthProfile & WeeklyProjectionResult & {
  bmi: number;
  dailyCalories: number;
  targetDate: Date;
};

const activityFactor: Record<QuizInput["activity"], number> = {
  low: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725
};

export function buildWeeklyProjection(weightKg: number, targetWeightKg: number): WeeklyProjectionResult {
  if (!Number.isFinite(targetWeightKg) || targetWeightKg < 30 || targetWeightKg > 250) {
    throw new Error("Target weight must be between 30 and 250 kg.");
  }

  const difference = weightKg - targetWeightKg;
  if (Math.abs(difference) > 50) {
    throw new Error("Target weight must be within 50 kg of current weight.");
  }
  if (difference <= 0) {
    return {
      weeklyProjection: null,
      projectionReason: "A weight-loss projection requires a target below the current weight."
    };
  }

  const weeks = Math.min(4, Math.ceil(difference / 0.75));
  const weeklyProjection = Array.from({ length: weeks }, (_, index) => {
    const week = index + 1;
    return {
      week,
      weight: Number(Math.max(targetWeightKg, weightKg - week * 0.75).toFixed(2))
    };
  });
  return { weeklyProjection, projectionReason: null };
}

export function inferHealthProfile(input: Pick<QuizInput, "activity" | "goal">, bmi: number): HealthProfile {
  // Body type is a coarse BMI band required by the product brief, not a clinical diagnosis.
  const bodyType = bmi < 18.5 ? "Ectomorph" : bmi <= 25 ? "Mesomorph" : "Endomorph";

  // Exercise frequency is the only activity signal in the current questionnaire.
  const activityLevel = input.activity === "low"
    ? "Beginner"
    : input.activity === "high"
      ? "Advanced"
      : "Intermediate";

  // No work-schedule field exists yet, so lifestyle uses daily activity without inventing shift data.
  const lifestyle = input.activity === "low"
    ? "Sedentary"
    : input.activity === "light"
      ? "Lightly Active"
      : "Active";

  // Goal is the questionnaire's current proxy for weight-change tendency until history is collected.
  const metabolism = input.goal === "lose" ? "Slow" : input.goal === "gain" ? "Fast" : "Balanced";

  return { bodyType, lifestyle, activityLevel, metabolism };
}

export function calculateHealth(input: QuizInput, now: Date): HealthAssessment {
  if (!Number.isFinite(input.heightCm) || input.heightCm < 120 || input.heightCm > 230) {
    throw new Error("Height must be between 120 and 230 cm.");
  }
  if (!Number.isFinite(input.weightKg) || input.weightKg < 35 || input.weightKg > 300) {
    throw new Error("Weight must be between 35 and 300 kg.");
  }

  const heightM = input.heightCm / 100;
  const bmi = Number((input.weightKg / heightM ** 2).toFixed(1));
  const genderOffset = input.gender === "male" ? 5 : input.gender === "female" ? -161 : -78;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + genderOffset;
  const goalOffset = input.goal === "lose" ? -400 : input.goal === "gain" ? 300 : 0;
  const dailyCalories = Math.max(1200, Math.round((bmr * activityFactor[input.activity] + goalOffset) / 50) * 50);
  const weeks = input.goal === "maintain" ? 4 : 12;
  const targetDate = new Date(now.getTime());
  targetDate.setDate(targetDate.getDate() + weeks * 7);

  return {
    bmi,
    dailyCalories,
    targetDate,
    ...buildWeeklyProjection(input.weightKg, input.targetWeightKg),
    ...inferHealthProfile(input, bmi)
  };
}

export function bmiLabel(bmi: number) {
  if (bmi < 18.5) return "Below the typical range";
  if (bmi < 25) return "Within the typical range";
  if (bmi < 30) return "Above the typical range";
  return "Well above the typical range";
}
