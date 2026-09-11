# Auth Flow

`resolveWinixAuthState` implements the runtime token strategy:

1. Use cached tokens if the ID token is present and the access token is still fresh (`WINIX_REFRESH_MARGIN_SECONDS` safety margin)
2. Otherwise refresh with Cognito `REFRESH_TOKEN`
3. If refresh fails, do full SRP login (`USER_SRP_AUTH`)

The SRP implementation is Worker-safe and relies on Web Crypto APIs.

Winix Smart 1.5.7 uses a public Cognito client without a client secret or
`SECRET_HASH`. SRP challenge responses use Cognito's canonical username and
forward the challenge session when supplied. Both login and refresh return the
ID token needed by the identity pool. Expiry remains in epoch seconds.

`resolveWinixSession` resolves the identity ID using that ID token, then sends
encrypted `/registerUser`, `/init`, `/checkAccessToken`, and `/getDeviceInfoList`
requests in that order. `createWinixDeviceClient(session.identityId)` binds the
identity to command URLs without sharing mutable session state between requests.

The AES-CBC wire parameters are shared parameters of the mobile app, not account
credentials. This protocol is also documented in
[winix-api](https://github.com/regaw-leinad/winix-api/tree/v2.0.2).
