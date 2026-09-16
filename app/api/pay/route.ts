import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const paymentSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().min(8).max(120)
});

export async function POST(request: Request) {
  try {
    const { userId, sessionId } = paymentSchema.parse(await request.json());
    const subscription = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return null;
      return tx.subscription.upsert({
        where: { userId },
        create: { userId, status: "active", plan: "monthly" },
        update: { status: "active" }
      });
    });
    if (!subscription) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ paid: true, sessionId, subscriptionId: subscription.id });
  } catch (error) {
    return apiError(error);
  }
}
