$ErrorActionPreference = "Stop"

Write-Host "One Time OBS Bridge setup"
Write-Host "1. Confirm OBS WebSocket is enabled on 127.0.0.1:4455 and password-protected."
Write-Host "2. Set ONETIME_BASE_URL, ONETIME_OBS_BRIDGE_TOKEN, LIVE_CLASS_OCCURRENCE_KEY, OBS_WEBSOCKET_URL, and OBS_WEBSOCKET_PASSWORD."
Write-Host "3. Run: npm --prefix tools/obs-bridge run bridge"
