import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LOCAL_ETL_SUPABASE_URL,
  isCloudSupabaseUrl,
  isLocalEtlSupabaseUrl,
  resolveEtlSupabaseUrl,
} from "../main-etl-env";

describe("main-etl-env local target", () => {
  it("detects cloud Supabase hosts", () => {
    assert.equal(
      isCloudSupabaseUrl("https://wavweetmtjoxzdirnfva.supabase.co"),
      true
    );
    assert.equal(isCloudSupabaseUrl("https://hris.greenpasture.com"), false);
  });

  it("allows on-prem and loopback URLs", () => {
    assert.equal(isLocalEtlSupabaseUrl("https://hris.greenpasture.com"), true);
    assert.equal(isLocalEtlSupabaseUrl("http://127.0.0.1:8000"), true);
    assert.equal(isLocalEtlSupabaseUrl("http://10.0.0.110:8000"), true);
    assert.equal(
      isLocalEtlSupabaseUrl("https://wavweetmtjoxzdirnfva.supabase.co"),
      false
    );
  });

  it("skips cloud NEXT_PUBLIC and falls back to local default", () => {
    const url = resolveEtlSupabaseUrl({
      NEXT_PUBLIC_SUPABASE_URL: "https://wavweetmtjoxzdirnfva.supabase.co",
    });
    assert.equal(url, DEFAULT_LOCAL_ETL_SUPABASE_URL);
  });

  it("prefers ETL_SUPABASE_URL when local", () => {
    const url = resolveEtlSupabaseUrl({
      ETL_SUPABASE_URL: "http://127.0.0.1:8000",
      NEXT_PUBLIC_SUPABASE_URL: "https://wavweetmtjoxzdirnfva.supabase.co",
    });
    assert.equal(url, "http://127.0.0.1:8000");
  });

  it("allows cloud only with ETL_ALLOW_CLOUD=1", () => {
    const cloud = "https://wavweetmtjoxzdirnfva.supabase.co";
    const url = resolveEtlSupabaseUrl({
      NEXT_PUBLIC_SUPABASE_URL: cloud,
      ETL_ALLOW_CLOUD: "1",
    });
    assert.equal(url, cloud);
  });
});
