"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type AppClientProps = {
  email: string;
};

type TaskStatus = "active" | "completed" | "archived";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: string;
};

type Step = {
  id: string;
  task_id: string;
  step_index: number;
  text: string;
  done: boolean;
};

export default function AppClient({ email }: AppClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [stepsByTask, setStepsByTask] = useState<Record<string, Step[]>>({});
  const [taskError, setTaskError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const handleSignOut = async () => {
    setStatus("loading");
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    const loadTasks = async () => {
      setLoadingTasks(true);
      setTaskError(null);
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setTaskError(error.message);
      } else {
        setTasks((data ?? []) as Task[]);
      }
    };

    const loadSteps = async () => {
      const { data, error } = await supabase
        .from("steps")
        .select("id, task_id, step_index, text, done")
        .order("step_index", { ascending: true });

      if (error) {
        setTaskError(error.message);
        return;
      }

      const grouped: Record<string, Step[]> = {};
      (data ?? []).forEach((step) => {
        grouped[step.task_id] ??= [];
        grouped[step.task_id].push(step as Step);
      });
      setStepsByTask(grouped);
    };

    const loadData = async () => {
      await loadTasks();
      await loadSteps();
      setLoadingTasks(false);
    };

    loadData();
  }, [supabase]);

  const setBusy = (taskId: string, isBusy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const handleAddTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim()) {
      return;
    }

    setTaskError(null);
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
      return;
    }

    if (data) {
      setTasks((prev) => [data as Task, ...prev]);
    }
  };

  const handleDelete = async (taskId: string) => {
    setBusy(taskId, true);
    setTaskError(null);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      setTaskError(error.message);
      setBusy(taskId, false);
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setStepsByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setBusy(taskId, false);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    setBusy(taskId, true);
    setTaskError(null);
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select("id, title, status, created_at")
      .single();

    if (error) {
      setTaskError(error.message);
      setBusy(taskId, false);
      return;
    }

    if (data) {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? (data as Task) : task))
      );
    }

    setBusy(taskId, false);
  };

  const handleToggleComplete = async (task: Task) => {
    const nextStatus: TaskStatus =
      task.status === "completed" ? "active" : "completed";
    await updateTask(task.id, { status: nextStatus });
  };

  const handleArchive = async (taskId: string) => {
    await updateTask(taskId, { status: "archived" });
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
      return;
    }
    await updateTask(taskId, { title: editingTitle.trim() });
    cancelEditing();
  };

  const handleGenerateSteps = async (taskId: string) => {
    setBusy(taskId, true);
    setTaskError(null);

    const response = await fetch(`/api/tasks/${taskId}/generate-steps`, {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setTaskError(payload.error ?? "Failed to generate steps.");
      setBusy(taskId, false);
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
    setBusy(taskId, false);
  };

  const handleToggleStep = async (step: Step) => {
    setBusy(step.task_id, true);
    setTaskError(null);

    const { data, error } = await supabase
      .from("steps")
      .update({ done: !step.done })
      .eq("id", step.id)
      .select("id, task_id, step_index, text, done")
      .single();

    if (error) {
      setTaskError(error.message);
      setBusy(step.task_id, false);
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

    setBusy(step.task_id, false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Break It Down
          </p>
          <h1 className="text-2xl font-semibold">Your workspace</h1>
        </div>
        <button
          onClick={handleSignOut}
          disabled={status === "loading"}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "Signing out..." : "Logout"}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-16">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">{email}</p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Add a task</h2>
              <p className="text-sm text-slate-400">
                Keep it top-level. Steps come later.
              </p>
            </div>
            <form onSubmit={handleAddTask} className="flex flex-col gap-3">
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Example: Plan the weekend trip"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-600"
              />
              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Add task
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your tasks</h2>
            <span className="text-xs text-slate-400">
              {tasks.length} total
            </span>
          </div>

          {taskError ? (
            <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {taskError}
            </p>
          ) : null}

          {loadingTasks ? (
            <p className="mt-4 text-sm text-slate-400">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No tasks yet. Add one above.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {tasks.map((task) => {
                const isBusy = busyIds.has(task.id);
                const isEditing = editingId === task.id;
                const taskSteps = stepsByTask[task.id] ?? [];
                const hasSteps = taskSteps.length > 0;
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <StatusPill status={task.status} />
                          <span className="text-xs text-slate-500">
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {isEditing ? (
                          <input
                            value={editingTitle}
                            onChange={(event) =>
                              setEditingTitle(event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
                          />
                        ) : (
                          <p
                            className={`text-base font-semibold ${
                              task.status === "archived"
                                ? "text-slate-500 line-through"
                                : task.status === "completed"
                                  ? "text-emerald-200 line-through"
                                  : "text-slate-100"
                            }`}
                          >
                            {task.title}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => submitEditing(task.id)}
                              disabled={isBusy}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={isBusy}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {!hasSteps ? (
                              <button
                                onClick={() => handleGenerateSteps(task.id)}
                                disabled={isBusy}
                                className="rounded-full border border-sky-500/40 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:text-slate-500"
                              >
                                {isBusy ? "Working..." : "Break it down"}
                              </button>
                            ) : null}
                            <button
                              onClick={() => startEditing(task)}
                              disabled={isBusy || task.status === "archived"}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleComplete(task)}
                              disabled={isBusy || task.status === "archived"}
                              className="rounded-full border border-emerald-500/50 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:text-slate-500"
                            >
                              {task.status === "completed"
                                ? "Mark active"
                                : "Complete"}
                            </button>
                            <button
                              onClick={() => handleArchive(task.id)}
                              disabled={isBusy || task.status === "archived"}
                              className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:text-slate-500"
                            >
                              Archive
                            </button>
                            <button
                              onClick={() => handleDelete(task.id)}
                              disabled={isBusy}
                              className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:text-slate-500"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {hasSteps ? (
                      <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                        {taskSteps.map((step) => (
                          <label
                            key={step.id}
                            className="flex items-start gap-3 text-sm text-slate-200"
                          >
                            <input
                              type="checkbox"
                              checked={step.done}
                              onChange={() => handleToggleStep(step)}
                              disabled={isBusy}
                              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span
                              className={
                                step.done
                                  ? "text-slate-500 line-through"
                                  : "text-slate-200"
                              }
                            >
                              {step.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: TaskStatus }) {
  const styles =
    status === "active"
      ? "bg-sky-500/10 text-sky-200 border-sky-500/40"
      : status === "completed"
        ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/40"
        : "bg-slate-500/10 text-slate-300 border-slate-500/40";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${styles}`}
    >
      {status}
    </span>
  );
}
