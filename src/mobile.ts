// Wire-format constants from Winix Smart 1.5.7, also documented by winix-api:
// https://github.com/regaw-leinad/winix-api/blob/v2.0.2/src/account/winix-crypto.ts
// These are shared app protocol parameters, not account credentials.
const KEY_HEX = "84be38f854e320dd4a0a8c7fe0f3a9b84c288445916933fc222465bbd5a518d0";
const IV_HEX = "dfd55f316e72e97b905f8739005c99a7";

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hex.match(/../g)!, (byte) => Number.parseInt(byte, 16));
}

async function mobileKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromHex(KEY_HEX), "AES-CBC", false, ["encrypt", "decrypt"]);
}

export async function encryptMobilePayload(payload: object): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt(
    { name: "AES-CBC", iv: fromHex(IV_HEX) },
    await mobileKey(),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
}

export async function decryptMobilePayload<T>(body: ArrayBuffer): Promise<T> {
  const decoded = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: fromHex(IV_HEX) }, await mobileKey(), body,
  );
  return JSON.parse(new TextDecoder().decode(decoded)) as T;
}

type MobileResponse = { resultCode?: string | number; resultMessage?: string };

export async function postMobile<T extends MobileResponse>(path: string, payload: object): Promise<T> {
  const response = await fetch(`https://us.mobile.winix-iot.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", accept: "application/octet-stream" },
    body: await encryptMobilePayload(payload),
  });
  let data: T;
  try {
    data = await decryptMobilePayload<T>(await response.arrayBuffer());
  } catch {
    throw new Error(`Winix API ${path} returned an invalid encrypted response (HTTP ${response.status})`);
  }
  if (!data || !response.ok || String(data.resultCode) !== "200") {
    throw new Error(`Winix API ${path} failed (HTTP ${response.status}, code=${data?.resultCode ?? "unknown"}): ${data?.resultMessage ?? "missing result code"}`);
  }
  return data;
}
