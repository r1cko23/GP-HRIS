/**
 * File download Response. DOM BodyInit rejects Node Buffer and
 * `Uint8Array<ArrayBufferLike>` under current TypeScript lib.dom types.
 */

export function binaryFileResponse(
  bytes: Uint8Array,
  opts: { contentType: string; filename: string }
): Response {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Response(copy, {
    status: 200,
    headers: {
      "Content-Type": opts.contentType,
      "Content-Disposition": `attachment; filename="${opts.filename}"`,
    },
  });
}
