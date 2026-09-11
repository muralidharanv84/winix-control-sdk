# Examples

The SDK works in Node.js, Deno, and serverless JavaScript environments with native
fetch and Web Crypto. These examples use the public SDK API and require no
framework or AWS SDK dependency.

| Example | Use case | Runtime |
| --- | --- | --- |
| [Node.js CLI](node/control.mjs) | List purifiers or set one purifier's speed from a terminal, Raspberry Pi, or server | Node.js 20.6+ |
| [Deno](deno/list-devices.ts) | Discover devices and read their state directly from an npm import | Deno 2 |
| [AWS Lambda](aws-lambda/index.mjs) | Read or control one configured purifier from an invocation or scheduled event | Lambda Node.js 22 or 24 |

Run the Node.js examples from a checkout:

```bash
git clone https://github.com/muralidharanv84/winix-control-sdk.git
cd winix-control-sdk
npm ci
npm run build
```

Alternatively, copy a Node.js example into your own project and run
`npm install winix-control-sdk`. The Deno example imports the published npm package
directly, so it does not need an npm install or build.

For local runs, create a `.env` file (ignored by Git):

```dotenv
WINIX_USERNAME=you@example.com
WINIX_PASSWORD=your-password
```

Keep these credentials and cached tokens in the server or local script. A browser
UI should call your own authenticated backend instead of receiving Winix credentials.

## Node.js: list and control

List device IDs, aliases, and current states without sending control commands:

```bash
node --env-file=.env examples/node/control.mjs
```

Use a device ID from that output to select exactly one purifier:

```bash
node --env-file=.env examples/node/control.mjs YOUR_DEVICE_ID medium
```

The command ensures that purifier is on and in manual mode, then applies the speed.
Valid speeds are `low`, `medium`, `high`, and `turbo`. Winix's reported state can
take a moment to reflect a command; run the listing command again if needed.

The script also works as a one-shot command in cron, systemd timers, or a container.
For frequent polling, persist the `StoredWinixAuthState` returned by the SDK and
pass it back to `resolveWinixAuthState` to reuse or refresh tokens. This example
starts a new login for each process and does not write tokens to disk.

## Deno: discover and read devices

```bash
deno run --config=examples/deno/deno.json --env-file=.env \
  --allow-env=WINIX_USERNAME,WINIX_PASSWORD --allow-net \
  examples/deno/list-devices.ts
```

The script uses `npm:winix-control-sdk@0.3.0`, a committed integrity lockfile, and
native Deno Web Crypto. It prints
device IDs, aliases, models, power, mode, and airflow. It does not change settings.
See Deno's [npm compatibility](https://docs.deno.com/runtime/fundamentals/node/)
and [permissions](https://docs.deno.com/runtime/reference/permissions/) documentation.

## AWS Lambda: invoke or schedule control

Copy `examples/aws-lambda/index.mjs` into a separate deployment directory. From that
directory, install and package the dependency:

```bash
npm init -y
npm install --save-exact winix-control-sdk@0.3.0
zip -r function.zip index.mjs package.json package-lock.json node_modules
```

Create a Lambda function using Node.js 22 or 24, upload `function.zip`, set its
handler to `index.handler`, and allow a 60-second timeout for Winix's multi-request
authentication flow. Configure `WINIX_USERNAME`, `WINIX_PASSWORD`, and
`WINIX_DEVICE_ID` in the function environment. The function needs outbound HTTPS
access to Winix and Cognito; account authorization comes from your Winix login.

Invoke with `{}` to read the configured purifier's state. To turn it on, ensure
manual mode, and set a speed, use:

```json
{ "speed": "medium" }
```

The handler always targets `WINIX_DEVICE_ID`; a caller cannot select other devices
through the event. An EventBridge Scheduler invocation can supply the same JSON.
Invoke through AWS IAM rather than exposing this handler as an unauthenticated URL.

Auth tokens are reused within a warm Lambda environment. Cold starts log in again;
for frequent schedules, use a protected persistent token store. The cached token
expiry is epoch seconds, and the complete auth state includes `idToken`.

The handler can also be invoked locally after setting `WINIX_DEVICE_ID` in `.env`:

```bash
node --env-file=.env --input-type=module -e \
  'const { handler } = await import("./examples/aws-lambda/index.mjs"); console.log(await handler({}));'
```

See AWS's [Node.js handlers](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html)
and [ZIP packaging](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html)
documentation for deployment details.
