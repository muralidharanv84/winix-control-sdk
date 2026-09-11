import { afterEach, expect, it, vi } from "vitest";
import { createWinixDeviceClient, resolveWinixAuthState, resolveWinixSession } from "../src/index";
import { encryptMobilePayload } from "../src/mobile";
import { buildJwt } from "./utils";

afterEach(() => vi.restoreAllMocks());

it("refreshes auth, establishes a session and applies a fan speed through the public API", async () => {
  const accessToken = buildJwt("user-1");
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.hostname.startsWith("cognito-idp")) {
      return Response.json({ AuthenticationResult: { AccessToken: accessToken, IdToken: "id-token", ExpiresIn: 3600 } });
    }
    if (url.hostname.startsWith("cognito-identity")) return Response.json({ IdentityId: "us-east-1:identity" });
    if (url.hostname === "us.mobile.winix-iot.com") {
      return new Response(await encryptMobilePayload({ resultCode: "200", deviceInfoList: [{ deviceId: "device-1" }] }));
    }
    return Response.json({ headers: { resultCode: "S100", resultMessage: "" } });
  });

  const auth = await resolveWinixAuthState("u@example.com", "pw", {
    userId: "user-1", accessToken, refreshToken: "refresh-token", accessExpiresAt: 0,
  }, Math.floor(Date.now() / 1000));
  const session = await resolveWinixSession("u@example.com", auth);
  await createWinixDeviceClient(session.identityId).setAirflow(session.devices[0].deviceId, "high");
  expect(calls).toEqual([
    "/", "/", "/registerUser", "/init", "/checkAccessToken", "/getDeviceInfoList",
    "/common/control/devices/device-1/us-east-1:identity/A04:03",
  ]);
});
