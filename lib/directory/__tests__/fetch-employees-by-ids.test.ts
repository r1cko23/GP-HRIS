import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIRECTORY_ID_IN_CHUNK,
  fetchDirectoryEmployeesByIds,
} from "../fetch-employees-by-ids";

type FakeRow = { id: string; pay_through: string | null; gcash: string | null };

/** Mimics PostgREST: a single .in() of too many UUIDs overflows request headers. */
function makeFakeDirectory(all: FakeRow[], maxPerIn = 200) {
  const calls: string[][] = [];
  return {
    calls,
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            async in(_col: string, ids: string[]) {
              calls.push([...ids]);
              if (ids.length > maxPerIn) {
                return {
                  data: null,
                  error: {
                    message: "TypeError: fetch failed",
                    details: "HeadersOverflowError: Headers Overflow Error",
                  },
                };
              }
              const want = new Set(ids);
              return {
                data: all.filter((r) => want.has(r.id)),
                error: null,
              };
            },
          };
        },
      };
    },
  };
}

describe("fetchDirectoryEmployeesByIds", () => {
  it("returns empty for no ids without querying", async () => {
    const fake = makeFakeDirectory([]);
    const { data, error } = await fetchDirectoryEmployeesByIds(
      fake as never,
      [],
      "id, pay_through, gcash"
    );
    assert.equal(error, null);
    assert.deepEqual(data, []);
    assert.equal(fake.calls.length, 0);
  });

  it("loads all rows when id count exceeds one PostgREST .in() (Epicurean-scale)", async () => {
    const all: FakeRow[] = Array.from({ length: 524 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      pay_through: i === 0 ? "Gcash" : "ATM",
      gcash: i === 0 ? "09922457834" : null,
    }));
    const fake = makeFakeDirectory(all, 200);

    const { data, error } = await fetchDirectoryEmployeesByIds(
      fake as never,
      all.map((r) => r.id),
      "id, pay_through, gcash"
    );

    assert.equal(error, null);
    assert.equal(data?.length, 524);
    assert.ok(fake.calls.length >= 3, `expected chunked calls, got ${fake.calls.length}`);
    assert.ok(
      fake.calls.every((c) => c.length <= DIRECTORY_ID_IN_CHUNK),
      "each .in() must stay under header-safe chunk size"
    );
    const acibo = data?.find((r) => r.id === all[0].id) as FakeRow | undefined;
    assert.equal(acibo?.pay_through, "Gcash");
    assert.equal(acibo?.gcash, "09922457834");
  });

  it("surfaces the first chunk error", async () => {
    const fake = {
      from() {
        return {
          select() {
            return {
              async in() {
                return { data: null, error: { message: "db down" } };
              },
            };
          },
        };
      },
    };
    const { data, error } = await fetchDirectoryEmployeesByIds(
      fake as never,
      ["a", "b"],
      "id"
    );
    assert.equal(data, null);
    assert.equal(error?.message, "db down");
  });
});
