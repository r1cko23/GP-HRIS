import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { binaryFileResponse } from "../binary-file-response";

describe("binaryFileResponse", () => {
  it("accepts a Node Buffer without throwing", () => {
    const res = binaryFileResponse(Buffer.from("%PDF"), {
      contentType: "application/pdf",
      filename: "memo.pdf",
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/pdf");
    assert.match(
      res.headers.get("Content-Disposition") ?? "",
      /filename="memo\.pdf"/
    );
  });

  it("accepts an empty Uint8Array", () => {
    const res = binaryFileResponse(new Uint8Array(), {
      contentType: "application/zip",
      filename: "empty.zip",
    });
    assert.equal(res.status, 200);
  });
});
