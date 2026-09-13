import { NextResponse } from "next/server";
import { ask, type AiTask } from "@/lib/ai";
import { requireRole } from "@/lib/permissions";
import { z } from "zod";
import { apiError } from "@/lib/api";

export const maxDuration = 60;
const taskSchema = z.enum(["extract_iep", "session_summary", "next_steps"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ task: string }> },
) {
  try {
    const actor = await requireRole(["admin", "therapist"]);
    const task = taskSchema.parse((await params).task) as AiTask;
    const body = await request.json();
    const result = await ask(task, body.input, {
      clinicId: actor.clinicId,
      clientName: body.clientName,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
