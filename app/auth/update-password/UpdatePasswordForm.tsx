"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import {
  PASSWORD_SAVED_MESSAGE,
  passwordFormError,
  passwordSavedLoginHref,
} from "@/lib/auth-password";
import { completePasswordChange } from "./actions";

type SessionState = "checking" | "missing" | "ok";

export function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const required = searchParams.get("required") === "1";
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>("checking");

  useEffect(() => {
    const syncSession = () => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        setSessionState(session ? "ok" : "missing");
      });
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionState("ok");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  function showError(message: string) {
    setError(message);
    toast.error(message);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formError = passwordFormError(password, confirm);
    if (formError) {
      showError(formError);
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setLoading(false);
      showError(updateError.message);
      return;
    }

    const result = await completePasswordChange();
    if (result?.error) {
      setLoading(false);
      showError(result.error);
      return;
    }

    await supabase.auth.signOut();
    toast.success(PASSWORD_SAVED_MESSAGE);
    setLoading(false);
    router.replace(passwordSavedLoginHref());
    router.refresh();
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
          },
        }}
      />
      <form onSubmit={onSubmit} className="space-y-4">
        {required ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="status"
          >
            For security, you must set a new password before using HRIS.
          </div>
        ) : null}

        {sessionState === "checking" ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : null}

        {sessionState === "missing" ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            Session expired. Sign in again, then set your new password.
          </div>
        ) : null}

        {sessionState === "ok" ? (
          <>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Confirm new password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
                className={inputClass}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save password"}
            </button>
          </>
        ) : null}

        {!required ? (
          <p className="text-center text-sm">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-medium text-primary hover:underline"
            >
              Back to sign in
            </button>
          </p>
        ) : null}
      </form>
    </>
  );
}
