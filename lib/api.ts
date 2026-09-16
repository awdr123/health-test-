import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

const userIdSchema = z.string().uuid();

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Please check the highlighted answers.", details: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function requireUserId(request: Request) {
  const userId = new URL(request.url).searchParams.get("userId");
  const parsed = userIdSchema.safeParse(userId);
  return parsed.success ? parsed.data : null;
}
