import { NextResponse } from "next/server";
import { apiError, requireUserId } from "@/lib/api";
import { bmiLabel } from "@/lib/health";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const userId = requireUserId(request);
  if (!userId) return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });

  try {
    const [subscription, record] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId }, select: { status: true } }),
      prisma.healthRecord.findUnique({ where: { userId } })
    ]);
    if (!record?.completed || record.bmi === null) {
      return NextResponse.json({ error: "No completed assessment was found." }, { status: 404 });
    }
    const isMember = subscription?.status === "active";
    const shared = {
      recordId: record.id,
      isMember,
      bmi: record.bmi,
      bmiLabel: bmiLabel(record.bmi),
      goal: record.goal,
      bodyType: record.bodyType,
      lifestyle: record.lifestyle,
      activityLevel: record.activityLevel,
      metabolism: record.metabolism
    };
    if (!isMember) {
      return NextResponse.json({
        ...shared,
        dailyCalories: null,
        targetDate: null,
        weeklyProjection: null,
        plan: null,
        lockedFields: ["dailyCalories", "targetDate", "weeklyProjection", "plan"]
      });
    }
    return NextResponse.json({
      ...shared,
      dailyCalories: record.dailyCalories,
      targetDate: record.targetDate,
      weeklyProjection: record.weeklyProjection,
      plan: buildPlan(record.activity ?? "moderate"),
      lockedFields: []
    });
  } catch (error) {
    return apiError(error);
  }
}

function buildPlan(activity: string) {
  const movement = activity === "high" ? "Keep 4 active days and add 1 recovery session." : "Build toward 3 purposeful movement sessions each week.";
  return [
    "Use a balanced plate: half vegetables, one quarter protein, one quarter whole-food carbohydrates.",
    movement,
    "Review progress once a week and adjust gradually, not daily."
  ];
}
