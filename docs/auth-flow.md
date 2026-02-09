# Auth Flow

`resolveWinixAuthState` implements the runtime token strategy:

1. Use cached token if still fresh (`WINIX_REFRESH_MARGIN_SECONDS` safety margin)
2. Otherwise refresh with Cognito `REFRESH_TOKEN`
3. If refresh fails, do full SRP login (`USER_SRP_AUTH`)

The SRP implementation is Worker-safe and relies on Web Crypto APIs.
