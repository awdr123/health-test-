import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { calculateHealth } from "@/lib/health";
import { prisma } from "@/lib/prisma";
import { completeSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const input = completeSchema.parse(await request.json());
    const { projectionReason: _projectionReason, weeklyProjection, ...result } = calculateHealth(input, new Date());
    const data = {
      ...input,
      ...result,
      weeklyProjection: weeklyProjection ?? Prisma.DbNull,
      step: 6,
      completed: true
    };
    const record = await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: input.userId },
        create: { id: input.userId },
        update: { updatedAt: new Date() }
      });
      return tx.healthRecord.upsert({
        where: { userId: input.userId },
        create: data,
        update: data
      });
    });
    return NextResponse.json({ recordId: record.id });
  } catch (error) {
    return apiError(error);
  }
}
