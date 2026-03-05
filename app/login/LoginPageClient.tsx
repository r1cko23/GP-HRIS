"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster, toast } from "react-hot-toast";
import { getDeviceInfo, getDeviceModelLabel, getMacAddress } from "@/utils/device-info";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import { getOrCreateClientId } from "@/lib/clientId";

type LoginMode = "admin" | "employee";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const modeFromQuery = useMemo<LoginMode>(() => {
    return searchParams?.get("mode") === "employee" ? "employee" : "admin";
  }, [searchParams]);

  const [mode, setMode] = useState<LoginMode>(modeFromQuery);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [adminError, setAdminError] = useState<string>("");
  const [employeeError, setEmployeeError] = useState<string>("");

  useEffect(() => {
    setMode(modeFromQuery);
    setAdminError("");
    setEmployeeError("");

    // Check for password reset errors in URL hash (Supabase redirects here with errors)
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1));
        const error = params.get("error");
        const errorCode = params.get("error_code");
        const errorDescription = params.get("error_description");

        // If there's a password reset error, redirect to reset password page with error
        if (error && (errorCode === "otp_expired" || error === "access_denied")) {
          const resetUrl = new URL("/reset-password", window.location.origin);
          resetUrl.hash = hash; // Preserve error parameters
          router.replace(resetUrl.pathname + resetUrl.hash);
          return;
        }
      }
    }
  }, [modeFromQuery, router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Normalize Supabase auth errors to friendlier messages
        // Use generic wording to avoid credential enumeration
        const msg = "Invalid credentials. Please try again.";
        throw new Error(msg);
      }

      // Wait for session to be confirmed and persisted
      // This ensures the session cookie is set before redirecting
      if (data?.session) {
        // Explicitly set the session to ensure it's persisted
        // This helps ensure cookies are properly set
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        // Wait a moment for cookies to be written
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify session is accessible (this also ensures cookies are set)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error("Session not saved. Please try again.");
        }

        if (sessionData?.session) {
          toast.success("Login successful!");
          // Use window.location for full page reload to ensure cookies are read
          // This is more reliable than router.push() for auth state persistence
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 500);
        } else {
          throw new Error("Session not found after login. Please try again.");
        }
      } else {
        throw new Error("Login failed. Please try again.");
      }
    } catch (error: any) {
      const msg = error.message || "Invalid credentials. Please try again.";
      setAdminError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      const msg = "Enter your email to receive a reset link.";
      setAdminError(msg);
      toast.error(msg);
      return;
    }

    setResetLoading(true);
    setAdminError("");

    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      toast.success("If that email exists, a reset link was sent.");
    } catch (error: any) {
      const msg = "Could not send reset email. Try again.";
      setAdminError(msg);
      toast.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeId.trim() || !employeePassword.trim()) {
      toast.error("Please enter your Employee ID and password");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("authenticate_employee", {
        p_employee_id: employeeId.trim(),
        p_password: employeePassword.trim(),
      } as any);

      if (error) {
        // RPC error (e.g., function failure)
        throw new Error(error.message || "Failed to login");
      }

      const authData = data as Array<{
        success: boolean;
        employee_data?: {
          id: string;
          employee_id: string;
          full_name: string;
        };
      }> | null;

      if (!authData || authData.length === 0 || !authData[0].success) {
        // Use generic wording to avoid revealing if ID or password is wrong
        const errorMessage = "Invalid credentials. Please try again.";
        throw new Error(errorMessage);
      }

      const employeeData = authData[0].employee_data;
      if (!employeeData) {
        throw new Error("Invalid employee data received");
      }

      // Multi-device check: register this device and enforce max-device limit
      const deviceFingerprint = await getDeviceFingerprint();
      const clientId = getOrCreateClientId();
      const deviceLabel = getDeviceModelLabel();
      try {
        const deviceRes = await fetch("/api/employee/register-login-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeData.id,
            device_fingerprint: deviceFingerprint,
            client_id: clientId || undefined,
            device_label: deviceLabel,
          }),
        });
        const deviceResult = await deviceRes.json();
        if (deviceResult.allowed === false) {
          setEmployeeError(deviceResult.message || "Too many devices. Contact HR to continue.");
          toast.error(deviceResult.message || "Too many devices. Contact HR.");
          setLoading(false);
          return;
        }
        if (deviceResult.is_new_device || (deviceResult.total_device_count ?? 0) > 1) {
          toast("You have multiple devices linked to your account. Check My devices in the portal if you don't recognize one.", {
            icon: "🔐",
            duration: 5000,
          });
        }
      } catch (err) {
        console.error("Failed to register login device:", err);
        setEmployeeError("Device check failed. Please try again.");
        toast.error("Device check failed. Please try again.");
        setLoading(false);
        return;
      }

      // Capture device information for first login tracking
      const deviceInfo = getDeviceInfo();
      const macAddress = await getMacAddress();

      // Record first login (if applicable)
      try {
        const loginResponse = await fetch("/api/employee/first-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeData.id,
            user_agent: deviceInfo.userAgent,
            device_info: deviceInfo.deviceModelLabel ?? deviceInfo.deviceInfo,
            browser_name: deviceInfo.browserName,
            browser_version: deviceInfo.browserVersion,
            os_name: deviceInfo.osName,
            os_version: deviceInfo.osVersion,
            device_type: deviceInfo.deviceType,
            mac_address: macAddress,
          }),
        });

        const loginResult = await loginResponse.json();
        if (loginResult.is_first_login) {
          console.log("First login recorded for employee:", employeeData.employee_id);
        }
      } catch (error) {
        // Don't block login if first login recording fails
        console.error("Failed to record first login:", error);
      }

      // Set session with 8-hour expiration (same as typical work day)
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours from now

      localStorage.setItem(
        "employee_session",
        JSON.stringify({
          id: employeeData.id,
          employee_id: employeeData.employee_id,
          full_name: employeeData.full_name,
          loginTime: new Date().toISOString(),
          expiresAt: expiresAt,
        })
      );

      toast.success(`Welcome, ${employeeData.full_name}!`);
      router.push("/employee-portal/bundy");
    } catch (error: any) {
      const msg = "Invalid credentials. Please try again.";
      setEmployeeError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/40 p-4">
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
      <div className="max-w-md w-full">
        <div
          className="bg-card/95 backdrop-blur rounded-2xl shadow-xl border border-border/70 p-8"
          data-testid="login-card"
        >
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <img
                src="/gp-logo.webp"
                alt="Green Pasture People Management Inc."
                className="h-28 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-primary leading-tight mb-1">
              Green Pasture People Management Inc.
            </h1>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </div>

          <div className="grid grid-cols-2 mb-5 rounded-xl border bg-muted/40 p-1" role="tablist" aria-label="Login mode">
            <button
              role="tab"
              aria-selected={mode === "admin"}
              aria-pressed={mode === "admin"}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === "admin"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card"
              }`}
              onClick={() => setMode("admin")}
              data-testid="login-mode-admin"
              aria-label="Switch to admin login"
            >
              Admin / HR
            </button>
            <button
              role="tab"
              aria-selected={mode === "employee"}
              aria-pressed={mode === "employee"}
              className={`py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === "employee"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card"
              }`}
              onClick={() => setMode("employee")}
              data-testid="login-mode-employee"
              aria-label="Switch to employee login"
            >
              Employee
            </button>
          </div>

          {mode === "admin" ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring/40 focus:border-ring transition text-foreground"
                  placeholder="you@company.com"
                  data-testid="admin-email-input"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-3.5 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring/40 focus:border-ring transition text-foreground"
                  placeholder="••••••••"
                  data-testid="admin-password-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                data-testid="admin-signin-button"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="w-full text-sm font-medium text-primary/90 hover:text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="admin-forgot-password-button"
              >
                {resetLoading ? "Sending reset link..." : "Forgot password?"}
              </button>
              {adminError && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {adminError}
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Employee ID
                </label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full h-11 px-3.5 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring/40 focus:border-ring transition text-foreground"
                  placeholder="2025-001"
                  data-testid="employee-id-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  className="w-full h-11 px-3.5 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring/40 focus:border-ring transition text-foreground"
                  placeholder="Default is your Employee ID"
                  data-testid="employee-password-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                data-testid="employee-signin-button"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              {employeeError && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {employeeError}
                </p>
              )}
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              {mode === "admin"
                ? "Authorized personnel only"
                : "Use the credentials provided by HR"}
            </p>
          </div>
        </div>

        <div className="mt-5 text-center text-sm text-muted-foreground space-y-2">
          <p>
            © 2025 Green Pasture People Management Inc. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <a
              href="/privacy"
              className="text-primary hover:underline transition-colors"
            >
              Privacy Notice
            </a>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              Compliant with RA 10173 (Data Privacy Act)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}