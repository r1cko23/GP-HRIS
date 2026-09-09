import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CLIENT_PAGE = path.join(ROOT, "app/payroll-office/page.tsx");
const NODE_BUILTINS = new Set(["fs", "node:fs", "path", "node:path"]);
const IMPORT_RE =
  /(?:^|\n)\s*import(?!\s+type\b)(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g;

function resolveLocal(fromFile: string, spec: string): string | "builtin" | null {
  if (NODE_BUILTINS.has(spec)) return "builtin";
  let abs: string | null = null;
  if (spec.startsWith("@/")) abs = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) abs = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const candidate of [
    abs,
    `${abs}.ts`,
    `${abs}.tsx`,
    path.join(abs, "index.ts"),
    path.join(abs, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function specsIn(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    if (match[1]) out.push(match[1]);
  }
  return out;
}

function firstBuiltinChain(entry: string): string[] | null {
  const queue: { file: string; chain: string[] }[] = [
    { file: entry, chain: [path.relative(ROOT, entry)] },
  ];
  const seen = new Set<string>();
  while (queue.length) {
    const { file, chain } = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const spec of specsIn(source)) {
      const resolved = resolveLocal(file, spec);
      if (resolved === "builtin") {
        return [...chain, spec];
      }
      if (resolved) {
        queue.push({
          file: resolved,
          chain: [...chain, path.relative(ROOT, resolved)],
        });
      }
    }
  }
  return null;
}

describe("payroll-office client PDF export", () => {
  it("does not pull Node fs/path into the webpack client graph", () => {
    const chain = firstBuiltinChain(CLIENT_PAGE);
    assert.equal(chain, null, `client page reached a Node builtin via ${chain?.join(" → ")}`);
  });
});
