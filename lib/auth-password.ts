/** After first-login / reset password save, send them to sign in. */

export const PASSWORD_SAVED_QUERY = "passwordUpdated";

export const PASSWORD_SAVED_MESSAGE =
  "Password saved. Sign in with your new password.";

export const FORCE_CHANGE_PASSWORD_PATH = "/auth/update-password";

export const RESET_PASSWORD_PATH = "/reset-password";

export function passwordSavedLoginHref(): string {
  return `/login?${PASSWORD_SAVED_QUERY}=1`;
}

export function parsePasswordUpdatedParam(
  raw: string | null | undefined
): boolean {
  return raw === "1";
}

export function forceChangePasswordHref(required = true): string {
  return required
    ? `${FORCE_CHANGE_PASSWORD_PATH}?required=1`
    : FORCE_CHANGE_PASSWORD_PATH;
}

export function userMustChangePassword(
  user: { app_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  return Boolean(user?.app_metadata?.must_change_password);
}

/**
 * Where middleware / login should send a signed-in staff user.
 * Returns null when the current path is already correct.
 */
export function staffAuthRedirectPath(input: {
  pathname: string;
  mustChangePassword: boolean;
  postLoginPath: string;
}): string | null {
  const { pathname, mustChangePassword, postLoginPath } = input;
  const onForcePage =
    pathname === FORCE_CHANGE_PASSWORD_PATH ||
    pathname.startsWith(`${FORCE_CHANGE_PASSWORD_PATH}/`);
  const onReset = pathname === RESET_PASSWORD_PATH;
  const onLogin = pathname === "/login";

  if (mustChangePassword) {
    if (onForcePage || onReset) return null;
    return forceChangePasswordHref(true);
  }

  if (onLogin) return postLoginPath;
  return null;
}

export function passwordFormError(
  password: string,
  confirm: string
): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password !== confirm) {
    return "Passwords do not match.";
  }
  return null;
}
