import { z } from "zod";

export const progressSchema = z.object({
  userId: z.string().uuid(),
  step: z.number().int().min(0).max(6),
  gender: z.enum(["female", "male", "nonbinary"]).optional(),
  goal: z.enum(["lose", "maintain", "gain"]).optional(),
  age: z.number().int().min(16).max(100).optional(),
  heightCm: z.number().min(120).max(230).optional(),
  weightKg: z.number().min(35).max(300).optional(),
  targetWeightKg: z.number().min(30).max(250).optional(),
  bodyType: z.string().trim().min(1).max(80).optional(),
  lifestyle: z.string().trim().min(1).max(80).optional(),
  activityLevel: z.string().trim().min(1).max(80).optional(),
  metabolism: z.string().trim().min(1).max(80).optional(),
  activity: z.enum(["low", "light", "moderate", "high"]).optional()
});

export const completeSchema = progressSchema.extend({
  gender: z.enum(["female", "male", "nonbinary"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  age: z.number().int().min(16).max(100),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(35).max(300),
  targetWeightKg: z.number().min(30).max(250),
  activity: z.enum(["low", "light", "moderate", "high"])
});

export type QuizInput = z.infer<typeof completeSchema>;
