const EVENT_TYPES = [
  "client.upserted",
  "employee.upserted",
  "employee.status_changed",
  "employee.rehired",
  "employee.transferred",
] as const;

export type DirectoryEventType = (typeof EVENT_TYPES)[number];

export async function emitDirectoryEvent(
  type: DirectoryEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const urls = (process.env.DIRECTORY_WEBHOOK_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length === 0) return;

  const body = JSON.stringify({
    type,
    occurred_at: new Date().toISOString(),
    payload,
  });

  await Promise.allSettled(
    urls.map((url) =>
      fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-directory-event": type,
        },
        body,
      })
    )
  );
}
