import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWinixSession } from "../src/account";
import { decryptMobilePayload, encryptMobilePayload } from "../src/mobile";
import { buildJwt } from "./utils";

export const identityId = "us-east-1:test-identity";
export const auth = {
  userId: "user-1", accessToken: buildJwt("user-1"), idToken: "id-token",
  refreshToken: "refresh-token", accessExpiresAt: 999999,
};

afterEach(() => vi.restoreAllMocks());

describe("resolveWinixSession", () => {
  it("resolves identity, performs the encrypted handshake, and maps devices", async () => {
    const paths: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      if (url.hostname.startsWith("cognito-identity")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          IdentityPoolId: "us-east-1:84008e15-d6af-4698-8646-66d05c1abe8b",
          Logins: { "cognito-idp.us-east-1.amazonaws.com/us-east-1_Ofd50EosD": "id-token" },
        });
        return Response.json({ IdentityId: identityId });
      }
      expect(init?.headers).toMatchObject({ "content-type": "application/octet-stream" });
      const body = await decryptMobilePayload<Record<string, unknown>>(init?.body as ArrayBuffer);
      expect(body.accessToken).toBe(auth.accessToken);
      expect(body.uuid).toMatch(/^[a-f0-9]{16}$/);
      expect(body.cognitoClientSecretKey).toBeUndefined();
      if (url.pathname === "/registerUser" || url.pathname === "/checkAccessToken") {
        expect(body.identityId).toBe(identityId);
        expect(body.appVersion).toBe("1.5.7");
      }
      if (url.pathname === "/registerUser") expect(body.email).toBe("u@example.com");
      if (url.pathname === "/init") expect(body.region).toBe("US");
      return new Response(await encryptMobilePayload({
        resultCode: "200",
        deviceInfoList: [{ deviceId: "device-1", deviceAlias: "Living", modelName: "T800" }, { deviceId: "device-2" }, { deviceId: "" }],
      }));
    });

    const session = await resolveWinixSession("u@example.com", auth);
    expect(session.identityId).toBe(identityId);
    expect(session.auth).toBe(auth);
    expect(session.devices).toEqual([
      { deviceId: "device-1", alias: "Living", model: "T800" },
      { deviceId: "device-2", alias: null, model: null },
    ]);
    expect(paths).toEqual(["/", "/registerUser", "/init", "/checkAccessToken", "/getDeviceInfoList"]);
  });

  it("rejects a legacy cache before making account requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(resolveWinixSession("u@example.com", { ...auth, idToken: null })).rejects.toThrow("requires an ID token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    [401, { message: "Not authorized" }, "Not authorized"],
    [200, {}, "missing IdentityId"],
  ])("rejects an unsuccessful identity lookup (%s)", async (status, body, message) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }));
    await expect(resolveWinixSession("u@example.com", auth)).rejects.toThrow(message);
  });

  it("handles accounts with no device list", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ IdentityId: identityId }))
      .mockImplementation(async () => new Response(await encryptMobilePayload({ resultCode: "200" })));
    expect((await resolveWinixSession("u@example.com", auth)).devices).toEqual([]);
  });
});
