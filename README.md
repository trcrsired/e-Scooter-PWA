# E-Scooter-PWA
a GPLv3 free software of PWA for e-scooter

- `source/` — the PWA itself; serve this directory (`python3 -m http.server`)
  - `tuya_ble.js` — the Tuya BLE (central/app side) protocol: GATT transport
    framing, CRC16, AES-128-CBC, the device-info/pair handshake and datapoint
    encode/decode. Ported from the `tuya_ble` / `ha_tuya_ble` reference.
  - `app.js` — UI, credential storage, CBC wrapper over the wasm crypto, and
    auto-generated controls from the datapoint spec in `keys.json`.
  - `tuya_crypto.wasm` — MD5 + AES-128 (ECB primitive; CBC is built in JS).
- `cpp/` — `tuya_crypto.cpp`, built to `source/tuya_crypto.wasm` with
  clang + fast_io (see comment in the file)
- `tools/` — `fetch_keys.py` pulls device credentials from Tuya OpenAPI
- `how-it-works.md` — protocol analysis notes

## Usage

```
.venv/bin/python tools/fetch_keys.py          # writes source/keys.json
cd source && python3 -m http.server 8080      # serve the PWA
```

Open it from a secure context (localhost, `adb reverse`, or HTTPS), click
**Connect to scooter**, pick the device, and the writable/read-only datapoints
from `keys.json` appear as controls. Without `keys.json` you can still enter
`local_key`, `device_id` and `uuid` in Settings.

## Protocol note

`tuya_ble.js` implements the *classic* Tuya BLE handshake (security flags 4/5,
session key = `md5(login_key[0:6] + srand)`), i.e. exactly the scheme used by
`ha_tuya_ble`/`tuya_ble`. Some newer firmware uses the "secure V2" scheme
(security modes 11–16, as in `../TuyaOpen/src/tuya_cloud_service/ble/`); if the
handshake times out, the device is likely one of those and that path would need
to be added.
