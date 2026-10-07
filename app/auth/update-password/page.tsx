import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-card sm:p-8">
        <PageHeader
          title="Choose a new password"
          className="mb-6 border-b-0 pb-0 sm:pb-0 lg:pb-0"
        />
        <Suspense
          fallback={
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          }
        >
          <UpdatePasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
