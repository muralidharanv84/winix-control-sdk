# Troubleshooting

## Authentication fails repeatedly

- Verify username casing exactly matches Winix login account.
- Verify password and secure secret handling in runtime.
- If refresh is failing, confirm full login fallback is not blocked upstream.
- `User pool client does not exist` means an old SDK is using Winix's retired
  Cognito client. Upgrade to 0.3 or later.
- Persist the returned ID token. Older cached auth is refreshed automatically.

## Session resolves but no devices are listed

- Check Winix account association in mobile app.
- Confirm the identity lookup and encrypted `/registerUser`, `/init`, and
  `/checkAccessToken` calls are succeeding.

## Device commands fail

- Confirm target device IDs are valid.
- Retry after checking Winix service availability.
- Construct the device client with the session's identity ID; the old hardcoded
  `A211` command path is no longer valid.
- An HTTP 200 response can still indicate `device not connected` or another
  device error. The SDK rejects these commands with the API message.
