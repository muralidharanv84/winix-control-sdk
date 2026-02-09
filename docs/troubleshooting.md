# Troubleshooting

## Authentication fails repeatedly

- Verify username casing exactly matches Winix login account.
- Verify password and secure secret handling in runtime.
- If refresh is failing, confirm full login fallback is not blocked upstream.

## Session resolves but no devices are listed

- Check Winix account association in mobile app.
- Confirm `/registerUser` and `/checkAccessToken` calls are succeeding.

## Device commands return non-2xx

- Confirm target device IDs are valid.
- Retry after checking Winix service availability.
- Inspect raw response body in thrown error for API message details.
