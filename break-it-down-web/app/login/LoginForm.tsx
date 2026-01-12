"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "info">("info");

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
      setMessageTone("error");
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
      setMessageTone("error");
      setStatus("idle");
      return;
    }

    setMessage("Check your email to confirm your account, then sign in.");
    setMessageTone("info");
    setStatus("idle");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_55%),radial-gradient(circle_at_30%_20%,_rgba(148,163,184,0.18),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(241,245,249,0.9),_transparent_65%)]" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Break It Down
          </p>
          <CardTitle className="text-3xl">Sign in to continue</CardTitle>
          <CardDescription>
            Use your email and password to access your tasks.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <label className="block text-sm text-slate-300">
              Email
              <Input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                className="mt-2"
              />
            </label>

            {message ? (
              <div
                className={`rounded-xl border px-3 py-2 text-sm ${
                  messageTone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" disabled={status === "loading"} size="lg">
                {status === "loading" ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="button"
                onClick={handleSignUp}
                disabled={status === "loading"}
                variant="outline"
                size="lg"
              >
                Create account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
