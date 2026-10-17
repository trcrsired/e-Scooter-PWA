# How the e-scooter PWA may work

Notes on what stands between "the scooter beeps when we connect" and
"the PWA can actually control it". Written while reverse-engineering —
facts marked ✅ are confirmed, ❓ are hypotheses to verify.

## 1. What we know so far

- The scooter beeps when Web Bluetooth connects ✅
- Web Bluetooth can only speak **BLE (GATT)** — so the scooter's BLE
  stack is alive and it notices a central connecting ✅
- The control app is Tuya Smart / Smart Life ✅

## 2. The protocol layers

```
┌─────────────────────────────────────────────┐
│  UI: buttons (lock, speed mode, light, ...) │
├─────────────────────────────────────────────┤
│  DP commands (Tuya datapoints, see §5)      │
├─────────────────────────────────────────────┤
│  Tuya BLE frames: seq | type | len | data   │
│  + CRC16, payload AES-encrypted (see §4)    │
├─────────────────────────────────────────────┤
│  GATT write (v3: 0x2b11 · v4: 00000001-…07d0)  │
│  notifications (v3: 0x2b10 · v4: 00000002-…07d0)│
│  (v3 service 0xa201/0x1910 · v4 service 0xfd50) │
├─────────────────────────────────────────────┤
│  BLE link (this part already works → beep)  │
└─────────────────────────────────────────────┘
```

The beep means we reached the bottom two layers. Everything above is
what we still need to implement.

## 3. Step one: fingerprint the device

Web Bluetooth only grants access to services declared upfront in
`requestDevice()`, so the probe in `app.js` declares a broad candidate
list and enumerates whatever exists. Two outcomes:

### Outcome A — a Tuya BLE service is present

Two generations exist and are auto-detected from the advertised service
(`source/tuya_ble.js`):

| Gen | Service | Write char | Notify char | Device-info req | DP length |
|---|---|---|---|---|---|
| v3 | `0xa201` / `0x1910` | `00002b11-…34fb` | `00002b10-…34fb` | empty | 1 byte |
| **v4** | `0xfd50` | `00000001-0000-1001-8001-00805f9b07d0` | `00000002-0000-1001-8001-00805f9b07d0` | `[0x00,0xF3]` | 2 bytes (BE) |

**This scooter is v4** (confirmed from its GATT table: chars `…0001`/`…0002`
under service `0xfd50`). Everything below the GATT layer is shared. Reference:
Tuya's BLE porting docs + `PlusPlus-ua/ha_tuya_ble` + `jmdevita/tuya_eboard`
(which documents the v4 generation).

### Outcome B — some vendor service instead

Custom protocol. Usually *simpler*: many vendor apps just write short
byte commands. Then we skip the crypto and go straight to capturing +
replaying the app's writes (§6).

## 4. Tuya BLE protocol overview (outcome A)

Conceptual sketch — exact byte layout to be confirmed against the
`tuya_ble` source and our capture:

1. **Framing.** Each logical packet is
   `seq(4B) | response_to(4B) | code(2B) | length(2B) | payload | CRC16(2B)`,
   AES-128-CBC encrypted (see §4a). BLE MTU is small, so packets are
   split into ~20-byte chunks (varint sub-packet number; the first chunk
   also carries the total length + `protocol_version << 4`) and
   reassembled on the other side.
2. **Handshake.** *Device info* is encrypted with `login_key = md5(local_key[0:6])`
   (security flag 4, empty IV-derived CBC); the reply carries the 6-byte
   `srand` and the auth key. The *pair* request then uses the session key
   `md5(local_key[0:6] + srand)` (security flag 5). ✅ AES-128-**CBC** with a
   per-packet random IV (the old "AES-128-ECB" note was wrong).
3. **Credentials.** `login_key`/`local_key`/`device_id`/`uuid` are
   issued by Tuya cloud when the device is bound and are **static**
   afterwards — they do not rotate per session. Since the scooter is
   already bound to the Tuya Smart account, we fetch them once with a
   Tuya IoT developer project. This is exactly what `ha_tuya_ble` does.
4. **After pairing** the session behaves like normal Tuya: send DP
   commands, receive DP reports.

Browser wrinkle: WebCrypto has **no AES-ECB and no MD5**. Instead of
pure-JS fallbacks we compile fast_io's crypto (`aes128`, `md5_context`)
to wasm32 — see `cpp/tuya_crypto.cpp`, built with clang + herbceptions
per the WasmPass template. `tuya_crypto.wasm` sits next to `app.js` and
is verified against FIPS-197 vectors before we trust it on the scooter.

### Getting the keys to the PWA — no server needed

Because credentials are static, a "server" reduces to a one-shot CLI:

```
.venv/bin/python tools/fetch_keys.py   →  writes keys.json
cd source && python3 -m http.server 8080  →  serves the PWA
```

(`source/` is the web root — everything the site needs at runtime lives
there; `cpp/`, `tools/`, docs stay outside.)

`fetch_keys.py` (Tuya OpenAPI, same endpoints as `ha_tuya_ble`) dumps
`device_id / uuid / local_key / product_id / category` plus the
product's DP specification — the DP map for free.

Serving to a phone: plain `http://<lan-ip>` is an **insecure context**
and Web Bluetooth refuses to run. Options:

- `adb reverse tcp:8080 tcp:8080` — phone's `localhost:8080` forwards
  to the laptop; counts as secure ✅ (best for dev)
- deploy to GitHub Pages / any HTTPS host, and either ship `keys.json`
  with it or add a settings field that stores keys in `localStorage`
- Chrome flag `unsafely-treat-insecure-origin-as-secure` as a hack

## 5. Datapoints (DPs)

Tuya devices expose functions as numbered datapoints:

```
dpid | type (bool/value/enum/string/raw/bitmap) | value
```

E.g. a scooter might expose `dpid 1: bool = lock`, `dpid 12: enum =
speed_mode`, `dpid 20: value = battery %`. The DP map for the product
comes from two sources:

- **Tuya cloud**: the product's function definitions ("instruction set")
  on the IoT project, or the device detail API.
- **HCI snoop** (§6): watch which DP IDs/values the real app writes
  when you press each button.

## 6. Capturing the real app's traffic (Android)

1. Developer options → **Enable Bluetooth HCI snoop log**
2. Toggle Bluetooth off/on
3. Use the app: connect, lock/unlock, change mode, etc. — do each
   action a few times, note the clock time
4. Pull the log (location varies by Android version):
   - `adb shell dumpsys bluetooth_manager` then bugreport, or
   - `/sdcard/Android/data/btsnoop_hci.log` / `/data/misc/bluetooth/logs/`
5. Open in **Wireshark**, filter `btatt`, look at writes to handle of
   `0x2b10` (or whatever the write char is). If payloads decrypt to
   repeated patterns per action → map them to DPs.

## 7. Security / storage notes

- Device keys would live in `localStorage` (or IndexedDB). That's the
  same level of secrecy as the app itself, but be aware any script on
  the origin could read them.
- A Tuya BLE device is bound to one account; pairing from the PWA uses
  the *same* credentials, it doesn't re-bind the scooter away from the
  app (unless we call unbind — we won't).
- Web Bluetooth works in Chrome/Edge/Android; iOS needs a WebBT-capable
  browser shell (e.g. Bluefy).

## 8. Open questions

- ✅ GATT layout — this scooter is **v4** (service `0xfd50`, chars `…0001`
  write / `…0002` notify); v3 (`0xa201`, `2b10`/`2b11`) also supported
- ✅ Protocol version — read from device-info reply byte [2]; the app sends
  the v4 device-info payload `[0x00,0xF3]` and 2-byte DP lengths
- ❓ Which DP IDs map to lock / speed / lights / cruise / battery — taken
  automatically from the `functions`/`status` arrays in `keys.json`, or
  observed live on the wire (shown as tiles)
- ❓ Exact v4 DP-*send* framing — implemented as code `0x0027` with 2-byte
  lengths; neither reference project sends v4 DPs, so verify a benign DP
  (e.g. light) before trusting anything that affects motion
- ✅ Handshake runs on every connection (device info → pair → state query),
  implemented in `source/tuya_ble.js`
- ✅ Classic (flag 4/5) CBC frames — confirmed working path; secure-V2
  (modes 11–16, see `../TuyaOpen/…/ble/`) is not needed for this device

## 9. Reference material in this workspace

- `../tuya/` — the Tuya APKs, for static analysis if needed
  (apktool/jadx can reveal the BLE manager & protocol constants)
- `../tuya-device-handlers/` — Home Assistant's Tuya quirks lib. It is
  the *cloud* path, not BLE, but its datapoint model (dpid ↔ dpcode ↔
  type) documents the same DP semantics we'll parse.
- External: `tuya_ble` PyPI package / `ha_tuya_ble` repo — the closest
  thing to a clean portable implementation of §4.
