import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type GenerateStepsResponse = {
  steps: {
    id: string;
    task_id: string;
    step_index: number;
    text: string;
    done: boolean;
  }[];
};

export async function POST(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<GenerateStepsResponse | { error: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, user_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { count, error: stepsError } = await supabase
    .from("steps")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);

  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Steps already exist for this task." },
      { status: 409 }
    );
  }

  const aiServiceUrl =
    process.env.AI_SERVICE_URL?.replace(/\/$/, "") ||
    "http://localhost:8000";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let aiPayload: { steps?: string[] } | null = null;
  try {
    const aiResponse = await fetch(`${aiServiceUrl}/generate-steps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task: task.title }),
      signal: controller.signal,
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      return NextResponse.json(
        { error: `AI service error: ${errorBody || aiResponse.status}` },
        { status: 502 }
      );
    }

    aiPayload = (await aiResponse.json()) as { steps?: string[] };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "AI service timed out."
        : "Failed to reach AI service.";
    console.error("[generate-steps] AI fetch failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!aiPayload) {
    return NextResponse.json(
      { error: "AI service returned no data." },
      { status: 502 }
    );
  }
  if (!Array.isArray(aiPayload.steps) || aiPayload.steps.length !== 3) {
    return NextResponse.json(
      { error: "AI service returned invalid steps." },
      { status: 502 }
    );
  }

  const stepsToInsert = aiPayload.steps.map((text, index) => ({
    task_id: task.id,
    user_id: user.id,
    step_index: index + 1,
    text,
    done: false,
  }));

  const { data: insertedSteps, error: insertError } = await supabase
    .from("steps")
    .insert(stepsToInsert)
    .select("id, task_id, step_index, text, done");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    steps: (insertedSteps ?? []) as GenerateStepsResponse["steps"],
  });
}
