"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import { Step, Task, TaskStatus } from "@/lib/types";

type AppClientProps = {
  email: string;
  initialTasks: Task[];
  initialSteps: Step[];
};

export default function AppClient({
  email,
  initialTasks,
  initialSteps,
}: AppClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [stepsByTask, setStepsByTask] = useState<Record<string, Step[]>>(() => {
    const grouped: Record<string, Step[]> = {};
    initialSteps.forEach((step) => {
      grouped[step.task_id] ??= [];
      grouped[step.task_id].push(step);
    });
    return grouped;
  });
  const [taskError, setTaskError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set());
  const [busyStepIds, setBusyStepIds] = useState<Set<string>>(new Set());
  const [addingTask, setAddingTask] = useState(false);

  const handleSignOut = async () => {
    setStatus("loading");
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const setTaskBusy = (taskId: string, isBusy: boolean) => {
    setBusyTaskIds((prev) => {
      const next = new Set(prev);
      if (isBusy) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const setStepBusy = (stepId: string, isBusy: boolean) => {
    setBusyStepIds((prev) => {
      const next = new Set(prev);
      if (isBusy) {
        next.add(stepId);
      } else {
        next.delete(stepId);
      }
      return next;
    });
  };

  const handleAddTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) {
      setFormError("Add a short task title to continue.");
      return;
    }

    setTaskError(null);
    setFormError(null);
    setAddingTask(true);
    const title = newTitle.trim();
    setNewTitle("");

    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, status: "active" })
      .select("id, title, status, created_at")
      .single();

    if (error) {
      setTaskError(error.message);
      setNewTitle(title);
      setAddingTask(false);
      return;
    }

    if (data) {
      setTasks((prev) => [data as Task, ...prev]);
    }
    setAddingTask(false);
  };

  const handleDelete = async (taskId: string) => {
    setTaskBusy(taskId, true);
    setTaskError(null);
    setFormError(null);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      setTaskError(error.message);
      setTaskBusy(taskId, false);
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setStepsByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setTaskBusy(taskId, false);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    setTaskBusy(taskId, true);
    setTaskError(null);
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select("id, title, status, created_at")
      .single();

    if (error) {
      setTaskError(error.message);
      setTaskBusy(taskId, false);
      return;
    }

    if (data) {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? (data as Task) : task))
      );
    }

    setTaskBusy(taskId, false);
  };

  const handleToggleComplete = async (task: Task) => {
    const nextStatus: TaskStatus =
      task.status === "completed" ? "active" : "completed";
    await updateTask(task.id, { status: nextStatus });
  };

  const handleArchiveToggle = async (task: Task) => {
    const nextStatus: TaskStatus =
      task.status === "archived" ? "active" : "archived";
    await updateTask(task.id, { status: nextStatus });
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const submitEditing = async (taskId: string) => {
    if (!editingTitle.trim()) {
      setTaskError("Task title cannot be empty.");
      return;
    }
    await updateTask(taskId, { title: editingTitle.trim() });
    cancelEditing();
  };

  const handleGenerateSteps = async (taskId: string) => {
    setTaskBusy(taskId, true);
    setTaskError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`/api/tasks/${taskId}/generate-steps`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setTaskError(payload.error ?? "Failed to generate steps.");
        return;
      }

      const payload = (await response.json()) as { steps: Step[] };
      const orderedSteps = [...payload.steps].sort(
        (a, b) => a.step_index - b.step_index
      );
      setStepsByTask((prev) => ({
        ...prev,
        [taskId]: orderedSteps,
      }));
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "The AI service is taking too long. Please try again."
          : "Unable to reach the AI service.";
      setTaskError(message);
    } finally {
      window.clearTimeout(timeoutId);
      setTaskBusy(taskId, false);
    }
  };

  const handleToggleStep = async (step: Step) => {
    setStepBusy(step.id, true);
    setTaskError(null);
    setFormError(null);

    const { data, error } = await supabase
      .from("steps")
      .update({ done: !step.done })
      .eq("id", step.id)
      .select("id, task_id, step_index, text, done")
      .single();

    if (error) {
      setTaskError(error.message);
      setStepBusy(step.id, false);
      return;
    }

    if (data) {
      setStepsByTask((prev) => ({
        ...prev,
        [step.task_id]: (prev[step.task_id] ?? []).map((item) =>
          item.id === step.id ? (data as Step) : item
        ),
      }));
    }

    setStepBusy(step.id, false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_55%),radial-gradient(circle_at_30%_20%,_rgba(148,163,184,0.18),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(241,245,249,0.9),_transparent_65%)]" />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Break It Down
          </p>
          <h1 className="text-2xl font-semibold">Your workspace</h1>
        </div>
        <Button
          onClick={handleSignOut}
          disabled={status === "loading"}
          variant="outline"
          size="sm"
        >
          {status === "loading" ? "Signing out..." : "Logout"}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16">
        <Card>
          <CardHeader>
            <CardDescription>Signed in as</CardDescription>
            <CardTitle className="text-xl text-slate-900">{email}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a task</CardTitle>
            <CardDescription>
              Keep it top-level. Steps come later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTask} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={newTitle}
                  onChange={(event) => {
                    setNewTitle(event.target.value);
                    if (formError) {
                      setFormError(null);
                    }
                  }}
                  placeholder="Add a new task"
                  aria-invalid={formError ? true : undefined}
                />
                <Button
                  type="submit"
                  size="md"
                  disabled={addingTask}
                  className="h-11 w-full sm:w-12 sm:px-0"
                  aria-label="Add task"
                >
                  {addingTask ? "..." : "+"}
                </Button>
              </div>
              {formError ? (
                <p className="text-xs text-rose-600">{formError}</p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Your tasks</CardTitle>
              <CardDescription>
                {tasks.length} total tasks
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {taskError ? (
              <Alert className="mb-4">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{taskError}</AlertDescription>
              </Alert>
            ) : null}

            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
                No tasks yet. Add one above to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const isTaskBusy = busyTaskIds.has(task.id);
                  const isEditing = editingId === task.id;
                  const taskSteps = stepsByTask[task.id] ?? [];
                  const hasSteps = taskSteps.length > 0;
                  return (
                    <Card key={task.id} className="border-slate-200 bg-white">
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-1 flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <StatusPill status={task.status} />
                              <span className="text-xs text-slate-500">
                                {new Date(task.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {isEditing ? (
                              <Input
                                value={editingTitle}
                                onChange={(event) =>
                                  setEditingTitle(event.target.value)
                                }
                                className="h-10 rounded-xl"
                              />
                            ) : (
                              <p
                                className={`text-base font-semibold ${
                                  task.status === "archived"
                                    ? "text-slate-400 line-through"
                                    : task.status === "completed"
                                      ? "text-slate-500 line-through"
                                      : "text-slate-900"
                                }`}
                              >
                                {task.title}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  onClick={() => submitEditing(task.id)}
                                  disabled={isTaskBusy}
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  Save
                                </Button>
                                <Button
                                  onClick={cancelEditing}
                                  disabled={isTaskBusy}
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                {!hasSteps ? (
                                  <Button
                                    onClick={() =>
                                      handleGenerateSteps(task.id)
                                    }
                                    disabled={
                                      isTaskBusy || task.status === "archived"
                                    }
                                    variant="default"
                                    size="sm"
                                    className="rounded-lg"
                                  >
                                    {isTaskBusy ? "Working..." : "Break it down"}
                                  </Button>
                                ) : null}
                                <Button
                                  onClick={() => startEditing(task)}
                                  disabled={
                                    isTaskBusy || task.status === "archived"
                                  }
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleToggleComplete(task)}
                                  disabled={
                                    isTaskBusy || task.status === "archived"
                                  }
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  {task.status === "completed"
                                    ? "Mark active"
                                    : "Complete"}
                                </Button>
                                <Button
                                  onClick={() => handleArchiveToggle(task)}
                                  disabled={isTaskBusy}
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  {task.status === "archived"
                                    ? "Unarchive"
                                    : "Archive"}
                                </Button>
                                <Button
                                  onClick={() => handleDelete(task.id)}
                                  disabled={isTaskBusy}
                                  variant="destructive"
                                  size="sm"
                                  className="rounded-lg"
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {hasSteps ? (
                          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                            {taskSteps.map((step) => (
                              <label
                                key={step.id}
                                className="flex items-start gap-3 text-sm text-slate-700"
                              >
                                <Checkbox
                                  checked={step.done}
                                  onChange={() => handleToggleStep(step)}
                                  disabled={busyStepIds.has(step.id)}
                                />
                                <span
                                  className={
                                    step.done
                                      ? "text-slate-400 line-through"
                                      : "text-slate-700"
                                  }
                                >
                                  {step.text}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: TaskStatus }) {
  if (status === "completed") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (status === "archived") {
    return <Badge variant="muted">{status}</Badge>;
  }
  return <Badge variant="default">{status}</Badge>;
}
