import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  FORCE_CHANGE_PASSWORD_PATH,
  PASSWORD_SAVED_MESSAGE,
  forceChangePasswordHref,
  passwordFormError,
  passwordSavedLoginHref,
  parsePasswordUpdatedParam,
  staffAuthRedirectPath,
  userMustChangePassword,
} from "../auth-password";

const root = path.join(import.meta.dirname, "../..");

function src(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("userMustChangePassword", () => {
  it("is true only when app_metadata.must_change_password is set", () => {
    assert.equal(userMustChangePassword(null), false);
    assert.equal(userMustChangePassword(undefined), false);
    assert.equal(userMustChangePassword({}), false);
    assert.equal(
      userMustChangePassword({ app_metadata: { must_change_password: false } }),
      false
    );
    assert.equal(
      userMustChangePassword({ app_metadata: { must_change_password: true } }),
      true
    );
  });
});

describe("passwordFormError", () => {
  it("rejects short and mismatched passwords", () => {
    assert.equal(
      passwordFormError("secret", "secret"),
      "Password must be at least 8 characters."
    );
    assert.equal(
      passwordFormError("secret12", "secret13"),
      "Passwords do not match."
    );
    assert.equal(passwordFormError("secret12", "secret12"), null);
  });
});

describe("after a required first-login password save", () => {
  it("sends the user to sign in with a success flag", () => {
    assert.equal(passwordSavedLoginHref(), "/login?passwordUpdated=1");
    assert.equal(parsePasswordUpdatedParam("1"), true);
    assert.equal(parsePasswordUpdatedParam(null), false);
    assert.match(PASSWORD_SAVED_MESSAGE, /Sign in/);
  });

  it("blocks hubs until the password page, then allows post-login", () => {
    assert.equal(FORCE_CHANGE_PASSWORD_PATH, "/auth/update-password");
    assert.equal(
      forceChangePasswordHref(true),
      "/auth/update-password?required=1"
    );

    assert.equal(
      staffAuthRedirectPath({
        pathname: "/people",
        mustChangePassword: true,
        postLoginPath: "/people",
      }),
      "/auth/update-password?required=1"
    );
    assert.equal(
      staffAuthRedirectPath({
        pathname: "/login",
        mustChangePassword: true,
        postLoginPath: "/people",
      }),
      "/auth/update-password?required=1"
    );
    assert.equal(
      staffAuthRedirectPath({
        pathname: FORCE_CHANGE_PASSWORD_PATH,
        mustChangePassword: true,
        postLoginPath: "/people",
      }),
      null
    );
    assert.equal(
      staffAuthRedirectPath({
        pathname: "/reset-password",
        mustChangePassword: true,
        postLoginPath: "/people",
      }),
      null
    );
    assert.equal(
      staffAuthRedirectPath({
        pathname: "/login",
        mustChangePassword: false,
        postLoginPath: "/people",
      }),
      "/people"
    );
    assert.equal(
      staffAuthRedirectPath({
        pathname: "/people",
        mustChangePassword: false,
        postLoginPath: "/people",
      }),
      null
    );
  });

  it("creates staff users with must_change_password and clears it on save", () => {
    assert.match(
      src("app/api/users/create/route.ts"),
      /must_change_password:\s*true/
    );
    assert.match(
      src("scripts/provision-hr-access-packs.ts"),
      /must_change_password:\s*true/
    );
    assert.match(
      src("app/auth/update-password/actions.ts"),
      /must_change_password:\s*false/
    );
    const form = src("app/auth/update-password/UpdatePasswordForm.tsx");
    assert.match(form, /passwordSavedLoginHref/);
    assert.match(form, /signOut/);
    assert.doesNotMatch(form, /window\.location\.href\s*=\s*["']\/people/);
  });

  it("gates middleware and login, and shows the saved-password toast", () => {
    const middleware = src("middleware.ts");
    assert.match(middleware, /userMustChangePassword|staffAuthRedirectPath/);
    assert.match(middleware, /FORCE_CHANGE_PASSWORD_PATH|update-password/);

    const login = src("app/login/LoginPageClient.tsx");
    assert.match(login, /userMustChangePassword|forceChangePasswordHref/);
    assert.match(login, /PASSWORD_SAVED_MESSAGE|parsePasswordUpdatedParam/);

    const reset = src("app/reset-password/page.tsx");
    assert.match(reset, /completePasswordChange/);
    assert.match(reset, /passwordSavedLoginHref/);
    assert.match(reset, /signOut/);
  });
});
