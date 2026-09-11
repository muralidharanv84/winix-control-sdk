import { COGNITO_IDENTITY_POOL_ID, COGNITO_REGION, COGNITO_USER_POOL_ID } from "./constants.js";
import { postMobile } from "./mobile.js";
import type { StoredWinixAuthState, WinixResolvedSession } from "./types.js";

export type WinixApiDevice = {
  deviceId: string;
  deviceAlias?: string;
  modelName?: string;
};

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(text: string): string {
  let crc = -1;
  for (const byte of new TextEncoder().encode(text)) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).padStart(8, "0");
}

async function resolveIdentityId(idToken: string): Promise<string> {
  const response = await fetch(`https://cognito-identity.${COGNITO_REGION}.amazonaws.com/`, {
    method: "POST",
    headers: { "content-type": "application/x-amz-json-1.1", "x-amz-target": "AWSCognitoIdentityService.GetId" },
    body: JSON.stringify({
      IdentityPoolId: COGNITO_IDENTITY_POOL_ID,
      Logins: { [`cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`]: idToken },
    }),
  });
  const data = await response.json() as { IdentityId?: string; message?: string };
  if (!response.ok || !data.IdentityId) {
    throw new Error(`Cognito identity lookup failed (HTTP ${response.status}): ${data.message ?? "missing IdentityId"}`);
  }
  return data.IdentityId;
}

export interface WinixAccountHandle {
  identityId: string;
  getDevices(): Promise<WinixApiDevice[]>;
}

export interface WinixAccountProvider {
  fromAuth(username: string, auth: StoredWinixAuthState): Promise<WinixAccountHandle>;
}

export const defaultWinixAccountProvider: WinixAccountProvider = {
  async fromAuth(username, auth) {
    if (!auth.idToken) throw new Error("Winix session requires an ID token; resolve auth again to refresh legacy tokens");
    const identityId = await resolveIdentityId(auth.idToken);
    const uuid = crc32(`github.com/hfern/winixctl${auth.userId}`) + crc32(`HGF${auth.userId}`);
    const tokenPayload = { accessToken: auth.accessToken, uuid };
    const mobilePayload = {
      ...tokenPayload, identityId, osVersion: "29", mobileLang: "en",
      appVersion: "1.5.7", mobileModel: "SM-G988B",
    };

    await postMobile("/registerUser", { ...mobilePayload, email: username, osType: "android" });
    await postMobile("/init", { ...tokenPayload, region: "US" });
    await postMobile("/checkAccessToken", mobilePayload);

    return {
      identityId,
      async getDevices() {
        const result = await postMobile<{ resultCode: string; deviceInfoList?: WinixApiDevice[] }>("/getDeviceInfoList", tokenPayload);
        return result.deviceInfoList ?? [];
      },
    };
  },
};

export async function resolveWinixSession(
  username: string,
  auth: StoredWinixAuthState,
  provider: WinixAccountProvider = defaultWinixAccountProvider,
): Promise<WinixResolvedSession> {
  const account = await provider.fromAuth(username, auth);
  const devices = await account.getDevices();
  return {
    auth,
    identityId: account.identityId,
    devices: devices.filter((device) => device.deviceId).map((device) => ({
      deviceId: device.deviceId, alias: device.deviceAlias ?? null, model: device.modelName ?? null,
    })),
  };
}
