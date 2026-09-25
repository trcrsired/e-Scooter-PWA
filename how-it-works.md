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
│  GATT writes to char 0x2b10                 │
│  notifications from char 0x2b11             │
│  (service 0x1910 — "Tuya BLE serial")       │
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

### Outcome A — service `0x1910` is present

Standard Tuya BLE. Then the GATT table is almost certainly:

| UUID | Role |
|---|---|
| `00001910-...` | Tuya BLE serial service |
| `00002b10-...` | write (commands from us → scooter) |
| `00002b11-...` | notify (replies/events → us) |

We then implement the real Tuya BLE protocol (§4). Reference
implementation to port to JS: the **`tuya_ble` Python package**
(used by the `ha_tuya_ble` Home Assistant integration on GitHub).

### Outcome B — some vendor service instead

Custom protocol. Usually *simpler*: many vendor apps just write short
byte commands. Then we skip the crypto and go straight to capturing +
replaying the app's writes (§6).

## 4. Tuya BLE protocol overview (outcome A)

Conceptual sketch — exact byte layout to be confirmed against the
`tuya_ble` source and our capture:

1. **Framing.** Each logical packet is
   `seq(2B) | type(1-2B) | length(2B) | payload | CRC16(2B)`.
   BLE MTU is small, so packets are split into ~20-byte chunks and
   reassembled on the other side.
2. **Handshake.** Some commands are unencrypted, e.g. *device info*
   (returns device_id, product id, firmware version, bound flag) and
   *pair*. The pair exchange mixes random numbers from both sides to
   derive a **session key** — roughly `MD5(login_key + randoms)`,
   then AES-128-ECB-encrypts payloads from then on. ✅ AES-128-ECB
   (confirmed against `tuya_ble`: `AES.new(key, AES.MODE_ECB)`)
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

- ❓ Is service `0x1910` actually present? (run the probe)
- ❓ Protocol version the firmware speaks (v3/v4/v5 differ in packet
  layout) — visible once we see device_info bytes
- ❓ Which DP IDs map to lock / speed / lights / cruise / battery
- ❓ Does it demand a pair handshake on every connection, or accept
  the stored session?

## 9. Reference material in this workspace

- `../tuya/` — the Tuya APKs, for static analysis if needed
  (apktool/jadx can reveal the BLE manager & protocol constants)
- `../tuya-device-handlers/` — Home Assistant's Tuya quirks lib. It is
  the *cloud* path, not BLE, but its datapoint model (dpid ↔ dpcode ↔
  type) documents the same DP semantics we'll parse.
- External: `tuya_ble` PyPI package / `ha_tuya_ble` repo — the closest
  thing to a clean portable implementation of §4.
