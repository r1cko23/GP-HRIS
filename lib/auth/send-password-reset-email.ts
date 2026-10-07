import { deliverPasswordResetMail } from "./password-reset-mail";

export type GenerateRecoveryLinkResult =
  | { ok: true; actionLink: string; name?: string }
  | { ok: false; error: string };

export type SendPasswordResetEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendPasswordResetEmail(
  input: { email: string; redirectTo: string },
  deps?: {
    generateRecoveryLink?: (args: {
      email: string;
      redirectTo: string;
    }) => Promise<GenerateRecoveryLinkResult>;
    deliver?: (input: {
      to: string;
      name?: string;
      resetUrl: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
  }
): Promise<SendPasswordResetEmailResult> {
  const generate =
    deps?.generateRecoveryLink ??
    (async () => ({
      ok: false as const,
      error: "Recovery link generator is not configured.",
    }));
  const deliver = deps?.deliver ?? deliverPasswordResetMail;

  const link = await generate({
    email: input.email,
    redirectTo: input.redirectTo,
  });
  if (!link.ok) {
    return { ok: false, error: link.error };
  }

  const delivered = await deliver({
    to: input.email,
    name: link.name,
    resetUrl: link.actionLink,
  });
  if (!delivered.ok) {
    return { ok: false, error: delivered.error };
  }
  return { ok: true };
}
