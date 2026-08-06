import { NextResponse } from "next/server";
import { evaluateOpenAIDecision } from "@/lib/brain/openai-server";
import type { BrainInput } from "@/lib/brain";

export async function POST(request: Request) {
  const input = await request.json() as BrainInput;
  if (input?.task !== "decision" || !input.context || typeof input.context.yearlyGoal !== "string" || typeof input.context.todayAction !== "string") {
    return NextResponse.json({ error: "Invalid decision input" }, { status: 400 });
  }
  return NextResponse.json(await evaluateOpenAIDecision(input));
}
