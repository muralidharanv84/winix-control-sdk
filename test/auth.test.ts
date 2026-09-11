import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultWinixAuthProvider,
  resolveWinixAuthState,
  type WinixAuthProvider,
} from "../src/auth";
import type { StoredWinixAuthState } from "../src/types";
import { buildJwt } from "./utils";

function buildAuth(overrides: Partial<StoredWinixAuthState> = {}): StoredWinixAuthState {
  return {
    userId: "user-1",
    accessToken: "access-1",
    idToken: "id-1",
    refreshToken: "refresh-1",
    accessExpiresAt: 10_000,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveWinixAuthState", () => {
  it.each([false, true])("migrates legacy tokens without an ID token (revoked=%s)", async (revoked) => {
    const provider: WinixAuthProvider = {
      login: vi.fn().mockResolvedValue(buildAuth({ refreshToken: "new-refresh" })),
      refresh: revoked
        ? vi.fn().mockRejectedValue(new Error("Invalid Refresh Token"))
        : vi.fn().mockResolvedValue(buildAuth()),
    };
    const result = await resolveWinixAuthState("u@example.com", "pw", buildAuth({ idToken: null }), 1_000, provider);
    expect(result.idToken).toBe("id-1");
    expect(provider.refresh).toHaveBeenCalledWith("refresh-1", "user-1");
    expect(provider.login).toHaveBeenCalledTimes(revoked ? 1 : 0);
  });
  it("uses login when there is no stored auth", async () => {
    const provider: WinixAuthProvider = {
      login: vi.fn().mockResolvedValue(buildAuth({ accessToken: "new-access" })),
      refresh: vi.fn(),
    };

    const auth = await resolveWinixAuthState(
      "u@example.com",
      "password",
      null,
      1000,
      provider,
    );

    expect(auth.accessToken).toBe("new-access");
    expect(provider.login).toHaveBeenCalledTimes(1);
    expect(provider.refresh).toHaveBeenCalledTimes(0);
  });

  it("keeps stored auth when token is still fresh", async () => {
    const stored = buildAuth({ accessExpiresAt: 5000 });
    const provider: WinixAuthProvider = {
      login: vi.fn(),
      refresh: vi.fn(),
    };

    const auth = await resolveWinixAuthState(
      "u@example.com",
      "password",
      stored,
      1000,
      provider,
    );

    expect(auth).toEqual(stored);
    expect(provider.login).toHaveBeenCalledTimes(0);
    expect(provider.refresh).toHaveBeenCalledTimes(0);
  });

  it("refreshes expired stored auth", async () => {
    const provider: WinixAuthProvider = {
      login: vi.fn(),
      refresh: vi.fn().mockResolvedValue(buildAuth({ accessToken: "refreshed" })),
    };

    const auth = await resolveWinixAuthState(
      "u@example.com",
      "password",
      buildAuth({ accessExpiresAt: 1001 }),
      1000,
      provider,
    );

    expect(auth.accessToken).toBe("refreshed");
    expect(provider.refresh).toHaveBeenCalledTimes(1);
    expect(provider.login).toHaveBeenCalledTimes(0);
  });

  it("falls back to login when refresh fails", async () => {
    const provider: WinixAuthProvider = {
      login: vi.fn().mockResolvedValue(buildAuth({ accessToken: "login-fallback" })),
      refresh: vi.fn().mockRejectedValue(new Error("refresh failed")),
    };

    const auth = await resolveWinixAuthState(
      "u@example.com",
      "password",
      buildAuth({ accessExpiresAt: 1001 }),
      1000,
      provider,
    );

    expect(auth.accessToken).toBe("login-fallback");
    expect(provider.refresh).toHaveBeenCalledTimes(1);
    expect(provider.login).toHaveBeenCalledTimes(1);
  });
});

describe("defaultWinixAuthProvider", () => {
  it.each([
    [400, { message: "Invalid Refresh Token" }, "Invalid Refresh Token"],
    [200, { __type: "NotAuthorizedException" }, "NotAuthorizedException"],
  ])("propagates Cognito failures (%s)", async (status, body, message) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }));
    await expect(defaultWinixAuthProvider.refresh("old-token", "user-1")).rejects.toThrow(message);
  });

  it("rejects an invalid SRP server public value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
      ChallengeName: "PASSWORD_VERIFIER",
      ChallengeParameters: { USER_ID_FOR_SRP: "user", SALT: "ab", SRP_B: "0", SECRET_BLOCK: "YQ==" },
    }));
    await expect(defaultWinixAuthProvider.login("u@example.com", "pw")).rejects.toThrow("safety check for B");
  });

  it("rejects a challenge without SRP parameters", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ChallengeName: "PASSWORD_VERIFIER" }));
    await expect(defaultWinixAuthProvider.login("u@example.com", "pw")).rejects.toThrow("missing SRP parameters");
  });
  it("refreshes access token via Cognito REFRESH_TOKEN flow", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          AuthenticationResult: {
            AccessToken: "access-2",
            IdToken: "id-2",
            ExpiresIn: 3600,
          },
        }),
        { status: 200 },
      ),
    );

    const auth = await defaultWinixAuthProvider.refresh("refresh-1", "user-1");

    expect(auth.accessToken).toBe("access-2");
    expect(auth.idToken).toBe("id-2");
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(requestBody.ClientId).toBe("5rjk59c5tt7k9g8gpj0vd2qfg9");
    expect(requestBody.AuthParameters).toEqual({ REFRESH_TOKEN: "refresh-1" });
    expect(auth.refreshToken).toBe("refresh-1");
    expect(auth.userId).toBe("user-1");
    expect(auth.accessExpiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const req = fetchSpy.mock.calls[0];
    expect(req[0]).toContain("cognito-idp.us-east-1.amazonaws.com");
    expect((req[1] as RequestInit).headers).toMatchObject({
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
    });
  });

  it("throws when refresh response does not include access token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ AuthenticationResult: { ExpiresIn: 3600 } }),
        { status: 200 },
      ),
    );

    await expect(
      defaultWinixAuthProvider.refresh("refresh-1", "user-1"),
    ).rejects.toThrow("did not return complete auth tokens");
  });

  it("completes SRP login with mocked Cognito challenge/response", async () => {
    const accessToken = buildJwt("sub-user-1");

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ChallengeName: "PASSWORD_VERIFIER",
            Session: "challenge-session",
            ChallengeParameters: {
              USER_ID_FOR_SRP: "srp-user",
              SALT: "deadbeef",
              SRP_B:
                "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
              SECRET_BLOCK: Buffer.from("secret-block", "utf8").toString("base64"),
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AuthenticationResult: {
              AccessToken: accessToken,
              IdToken: "id-2",
              RefreshToken: "refresh-2",
              ExpiresIn: 3600,
            },
          }),
          { status: 200 },
        ),
      );

    const auth = await defaultWinixAuthProvider.login("u@example.com", "pw");

    expect(auth.userId).toBe("sub-user-1");
    expect(auth.refreshToken).toBe("refresh-2");
    expect(auth.accessToken).toBe(accessToken);
    expect(auth.idToken).toBe("id-2");
    const initiate = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    const challenge = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
    expect(initiate.ClientId).toBe("5rjk59c5tt7k9g8gpj0vd2qfg9");
    expect(initiate.AuthParameters.SECRET_HASH).toBeUndefined();
    expect(challenge.Session).toBe("challenge-session");
    expect(challenge.ChallengeResponses.USERNAME).toBe("srp-user");
    expect(challenge.ChallengeResponses.SECRET_HASH).toBeUndefined();
  });

  it("fails login when challenge name is unexpected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ChallengeName: "SMS_MFA",
          ChallengeParameters: {},
        }),
        { status: 200 },
      ),
    );

    await expect(
      defaultWinixAuthProvider.login("u@example.com", "pw"),
    ).rejects.toThrow("Unexpected Cognito challenge");
  });
});
