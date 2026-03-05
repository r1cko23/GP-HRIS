import { expect, type Page } from "@playwright/test";
import { filterBenignErrors } from "./ui";

export type PageRuntimeCapture = {
  consoleErrors: string[];
  failedRequests: string[];
};

export function capturePageRuntime(page: Page): PageRuntimeCapture {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown_error"}`);
  });

  return { consoleErrors, failedRequests };
}

export async function expectHealthyRuntime(capture: PageRuntimeCapture) {
  expect(filterBenignErrors(capture.consoleErrors)).toEqual([]);
  expect(capture.failedRequests).toEqual([]);
}
