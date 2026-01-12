"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom");

  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setStatus("idle");
      return;
    }

    router.push("/app");
    router.refresh();
  };

  const handleSignUp = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    setStatus("loading");
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setStatus("idle");
      return;
    }

    setMessage("Check your email to confirm your account, then sign in.");
    setStatus("idle");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Break It Down
          </p>
          <h1 className="text-3xl font-semibold">Sign in to continue</h1>
          <p className="text-sm text-slate-400">
            Use your email and password to access your tasks.
          </p>
          {redirectedFrom ? (
            <p className="text-xs text-amber-300">
              You were redirected from {redirectedFrom}.
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-slate-600"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition focus:border-slate-600"
            />
          </label>

          {message ? (
            <p className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/70"
            >
              {status === "loading" ? "Signing in..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={status === "loading"}
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
