# One Time OBS Bridge

Local classroom-computer helper for the One Time live classroom console.

The cloud app never receives the OBS WebSocket password. Keep OBS WebSocket bound to
`127.0.0.1` or the trusted classroom LAN, enable a password in OBS, and store that
password only on the classroom computer.

## One-Click Local Setup

1. In OBS, create scenes named `OT - Slides`, `OT - Featured Student`, and `OT - Break`.
2. Add sources named `PowerPoint / display capture`, `One Time Featured Student Stage browser/window`, and `Rabbi camera`.
3. Enable OBS WebSocket, bind it to `127.0.0.1:4455`, and set a password.
4. Set these local environment variables:
   - `ONETIME_BASE_URL`: Railway PR Environment URL.
   - `ONETIME_OBS_BRIDGE_TOKEN`: protected bridge token from the PR environment.
   - `LIVE_CLASS_OCCURRENCE_KEY`: active class occurrence key from the Rabbi Console.
   - `OBS_WEBSOCKET_URL`: `ws://127.0.0.1:4455`.
   - `OBS_WEBSOCKET_PASSWORD`: local OBS WebSocket password.
5. Run `npm --prefix tools/obs-bridge run bridge`.

Fake mode for PR validation:

```powershell
npm --prefix tools/obs-bridge run bridge:fake
```

The bridge polls `/api/v1/live-class/obs/commands`, executes only allowlisted
scene switches, reports success or failure, rejects replayed command nonces, and
writes a redacted local log to `tools/obs-bridge/logs/bridge.log`.
