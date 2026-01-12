"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type AppClientProps = {
  email: string;
};

export default function AppClient({ email }: AppClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const supabase = useMemo(() => createClient(), []);

  const handleSignOut = async () => {
    setStatus("loading");
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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

        <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-6 text-sm text-slate-400">
          Task UI is next in Milestone 2.
        </section>
      </main>
    </div>
  );
}
