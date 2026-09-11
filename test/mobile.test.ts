import { createCipheriv, createDecipheriv } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptMobilePayload, encryptMobilePayload, postMobile } from "../src/mobile";

const key = Buffer.from("84be38f854e320dd4a0a8c7fe0f3a9b84c288445916933fc222465bbd5a518d0", "hex");
const iv = Buffer.from("dfd55f316e72e97b905f8739005c99a7", "hex");
afterEach(() => vi.restoreAllMocks());

describe("mobile wire protocol", () => {
  it("matches the AES-CBC wire format independently of Web Crypto", async () => {
    const payload = { accessToken: "test-token", email: "dévice@example.com" };
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const reference = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    const encrypted = await encryptMobilePayload(payload);
    expect(Buffer.from(encrypted)).toEqual(reference);
    expect(await decryptMobilePayload(reference.buffer.slice(reference.byteOffset, reference.byteOffset + reference.byteLength) as ArrayBuffer)).toEqual(payload);
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    expect(JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]).toString())).toEqual(payload);
  });

  it.each([
    [400, { resultCode: "900", resultMessage: "session expired" }, "session expired"],
    [200, { resultCode: "500", resultMessage: "service unavailable" }, "service unavailable"],
    [200, {}, "missing result code"],
    [200, null, "missing result code"],
  ])("rejects unsuccessful mobile responses (%s, %j)", async (status, body, message) => {
    // JSON null is deliberately malformed protocol data.
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(body)), cipher.final()]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(encrypted, { status }));
    await expect(postMobile("/init", {})).rejects.toThrow(message);
  });

  it.each(["", "not encrypted"])("rejects unreadable responses (%s)", async (body) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 502 }));
    await expect(postMobile("/init", {})).rejects.toThrow("invalid encrypted response (HTTP 502)");
  });
});
