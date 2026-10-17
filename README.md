# E-Scooter-PWA
a GPLv3 free software of PWA for e-scooter

- `source/` — the PWA itself; serve this directory (`python3 -m http.server`)
  - `tuya_ble.js` — the Tuya BLE (central/app side) protocol: GATT transport
    framing, CRC16, AES-128-CBC, the device-info/pair handshake and datapoint
    encode/decode, for both generations (v3 `2b10`/`2b11`, v4 `0xfd50`).
    Ported from the `tuya_ble` / `ha_tuya_ble` / `tuya_eboard` references.
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
**Connect to scooter**, and pick the device. The writable/read-only datapoints
from `keys.json` appear as tiles; flip the **Enable sending commands** switch to
turn the writable ones into live controls (each send asks for confirmation).
Without `keys.json` you can still enter `local_key`, `device_id` and `uuid` in
Settings, watch the datapoints the scooter reports, and use the manual datapoint
sender.

## Safety

Commands are sent to the scooter only after you arm the switch **and** confirm
each send — the library refuses datapoint writes while `allowWrites` is false.
This scooter is Tuya BLE **v4**; because neither reference project sends v4
datapoints, verify a harmless datapoint (e.g. the light) before trusting any
DP that can affect motion.

## Protocol note

`tuya_ble.js` implements the *classic* Tuya BLE handshake (security flags 4/5,
session key = `md5(login_key[0:6] + srand)`), i.e. exactly the scheme used by
`ha_tuya_ble`/`tuya_ble`. Two GATT generations are auto-detected: **v3**
(`0xa201`, `2b10`/`2b11`, 1-byte DP length) and **v4** (`0xfd50`, chars
`…0001`/`…0002`, device-info `[0x00,0xF3]`, 2-byte DP length). Newer firmware
that uses the "secure V2" scheme (security modes 11–16, as in
`../TuyaOpen/src/tuya_cloud_service/ble/`) is not implemented; this scooter does
not need it.
