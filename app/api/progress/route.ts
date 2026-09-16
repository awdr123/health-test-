import { NextResponse } from "next/server";
import { apiError, requireUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { progressSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const userId = requireUserId(request);
  if (!userId) return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });

  try {
    const record = await prisma.healthRecord.findUnique({ where: { userId } });
    return NextResponse.json({ record });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = progressSchema.parse(await request.json());
    const data = {
      step: input.step,
      gender: input.gender,
      goal: input.goal,
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      targetWeightKg: input.targetWeightKg,
      bodyType: input.bodyType,
      lifestyle: input.lifestyle,
      activityLevel: input.activityLevel,
      metabolism: input.metabolism,
      activity: input.activity
    };
    const record = await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: input.userId },
        create: { id: input.userId },
        update: { updatedAt: new Date() }
      });
      return tx.healthRecord.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, ...data },
        update: data
      });
    });
    return NextResponse.json({ record });
  } catch (error) {
    return apiError(error);
  }
}
