# E-Scooter-PWA — implementation

A GPLv3 free-software PWA for a Tuya BLE e-scooter. For the project overview see
[`README.md`](README.md); this document covers how it is built and run.

- `source/` — the PWA itself; serve this directory (`python3 -m http.server`)
  - `tuya_ble.js` — the Tuya BLE (central/app side) protocol: GATT transport
    framing, CRC16, AES-128-CBC, the device-info/pair handshake and datapoint
    encode/decode, for both generations (v3 `2b10`/`2b11`, v4 `0xfd50`).
    Ported from the `tuya_ble` / `ha_tuya_ble` / `tuya_eboard` references.
  - `app.js` — UI, credential storage, CBC wrapper over the wasm crypto, and
    auto-generated controls from an imported datapoint spec.
  - `tuya_crypto.wasm` — MD5 + AES-128 (ECB primitive; CBC is built in JS).
  - `offline_state.js` — a tiny, dependency-free IndexedDB key/value store
    (`SimpleKVStore`, same minimal pattern as the pwa-player project) used to
    remember the last state each scooter reported.
  - `sw.js` — service worker (offline cache). **Bump `SW_VERSION` at the top
    every time this file changes**; a new version string invalidates the old
    cache so the installed PWA updates. It uses **stale-while-revalidate**: the
    app shell is served from the cache instantly and refreshed in the background,
    so a slow or dead connection never delays the load. Navigations fall back to
    the cached root (`./`, the manifest's `start_url`).
  - `sw-register.js` — registers the service worker and reloads once a new
    version takes over.
- `cpp/` — `tuya_crypto.cpp`, built to `source/tuya_crypto.wasm` with
  clang + fast_io (see comment in the file)
- `tools/` — `fetch_keys.py` pulls device credentials from Tuya OpenAPI
- `how-it-works.md` — protocol analysis notes

## Usage

```
cd source && python3 -m http.server 8080      # serve the PWA
```

Open it from a secure context (localhost, `adb reverse`, or HTTPS), click
**Connect to scooter**, and pick the device. Enter `local_key`, `device_id` and
`uuid` in Settings — or use **Load JSON config** there to import a Tuya device
JSON (or the `keys.json` produced by `tools/fetch_keys.py`). If that file also
contains the datapoint `functions`/`status` spec, the writable/read-only tiles
are built from it. Sending is **armed by default**; the raw Debug controls ask
for confirmation before each send, and you can turn sending off in Debug.

To reconnect later, just tap **Connect to scooter** again: the app remembers the
Bluetooth device it was last allowed to use and, on browsers that expose
`navigator.bluetooth.getDevices()` (Chrome/Edge desktop and Android), reuses it
**without showing the chooser**. Browsers without that API still show the
chooser each time — that is a Web Bluetooth limitation, not something the app
can bypass.

Credentials and the spec are imported deliberately through the UI; the app no
longer fetches anything from the server on its own.

## Screens

The main area has two tabs (the **Debug** tab is hidden by default — tap the
version number in the header five times to reveal the whole tab bar, five more
to hide it again; the choice is remembered in `localStorage`):

- **Ride** — a speed dashboard. A big hero shows your *GPS* speed. When the
  browser's Geolocation API supplies `coords.speed` (GNSS doppler) it is used
  **directly**, exactly like `pwa-geolocation`, even if it reads above the panel.
  Otherwise the app uses `pwa-geolocation`'s estimate (speed from an averaged
  start point → the current fix, then the average of the samples over a 30 s
  window), **capped at the scooter's own reported panel speed (dp 2)** so the
  estimate can never exceed what the scooter itself shows. Alongside it:
  trip / max / average / elapsed time, plus your
  live **GPS coordinates** (📍 latitude, longitude, 6 dp) while tracking. Pick the
  display unit (**km/h**, **mph** or **m/s**). Tracking is manual: press
  **Start tracking**. The scooter's own read-outs (panel speed, battery, voltage,
  temp, the lifetime odometer — dp 12, raw ÷ 10 = km — and the scooter's own
  trip distance dp 5 and trip time dp 6) are shown as cards. A **mode selector**
  (🚶 Walk / 🍃 Eco / 🛴 行驶 / ⚡ 运动) shows
  the current ride mode from the gear datapoint (dp 15) and lets you switch it
  (**sent immediately, no confirmation gate** — switching gear is a routine,
  reversible action). A **lock toggle** (dp 1 — the scooter's
  lock boolean, shown as 🔒 Locked / 🔓 Unlocked), a **headlight toggle**
  (dp 8, 💡 On / 🔌 Off) and a **“Cruise?”** toggle (dp 13 — see *Datapoint
  notes*) sit side by side right under the hero. When the app
  first receives the headlight state and it is **night (18:00–06:00 local
  time)** with the light off, it suggests turning it on (a toast plus a pulsing
  glow on the button, once per session). Below them, a **Scooter controls**
  panel holds the **start mode** selector (dp 16) and the **panel units**
  switch (dp 11 — the speed unit on the scooter's *own* display, `0` = km/h,
  `1` = mph, independent of the app's unit); both send directly and verify the
  result with a read-back.
  An optional **speed announcement**
  toggle speaks the current speed with the Web Speech API every *N* seconds
  (default 30). It is **unlimited by default** — leave the *times* box empty
  (shown as `∞`) to loop forever, or set a count. Spoken naturally, e.g. “22
  kilometers per hour”. A separate **speed warning**
  toggle (with a threshold in the current unit) flashes the hero red, vibrates
  and toasts when you ride faster than the limit.
- **Debug** — the raw datapoint UI: the safety note, the auto-generated
  spec-driven controls (datapoints we have identified are labelled with their
  meaning, e.g. `dp 1 (lock)`, `dp 8 (headlight)`, `dp 12 (total distance)`), a
  manual datapoint sender, a **Query scooter state**
  button (re-asks the scooter to report every datapoint, so you can see whether
  a write was accepted) and a **Dump datapoints (JSON)** button that writes every
  known datapoint (id, code, kind, type, last value) to a timestamped JSON file —
  handy for working out what a datapoint does. Plus the diagnostics log (every
  line is prefixed with an
  ISO 8601 timestamp, e.g. `2026-10-17T20:31:05.123Z`). A v4 DP write is
  acknowledged by the scooter with a `0x27` response that echoes the request's
  5-byte header and appends a **status byte** (`0x00` = accepted, non-zero =
  rejected), logged as `write ack: … status=0 (accepted)`. After a gear **or
  lock** write the app re-queries the scooter and compares the real read-back
  (`dp 15` / `dp 1`) against what it asked for, logging (and toasting) whether
  the scooter actually obeyed.

**Settings** (the ⚙ button) is a full-screen view with sections:
- **Language** — interface language (English / 中文) and which speech voice the
  announcements use. The list shows every voice the browser exposes; picking one
  also switches the announcement language to match the voice.
- **Scooter** — manage several scooters entirely in the UI: a picker to switch
  the active one, **Add** to create another, **Remove** to delete one, and the
  scooter's name (shown in the app bar). Each scooter also has a **Bluetooth name
  filter** (e.g. `demo`) which the connect flow uses as a `namePrefix` so the
  chooser only lists that scooter when several are nearby. After connecting, the
  app offers (once) to save the connected device's advertised name as the
  filter. Importing a JSON merges into this list, and the credentials below
  always apply to the selected scooter.
- **Speed limits** — the Eco / D / S maximum speed (dp 101 / 102 / 103, km/h).
  Each mode also has an editable **allowed range** (defaults, i.e. the values we
  reverse-engineered: Eco 5–15, D 10–24, S 20–31); the value is clamped to its
  range before being sent, and the value input's `min`/`max` follow it. Ranges
  and values are stored per profile and saved even offline; **changing a range
  triggers an extra safety warning confirmation** (a high maximum can make the
  scooter dangerously fast); only the values that changed are written, each sent
  directly.
- **Start mode** — how the scooter pulls away from a standstill (dp 16, an
  ENUM): `0` = start directly on the throttle, `1` = run/push to start. Lives on
  the **Ride** dashboard (Scooter controls), shown as a selector, sent directly
  and verified with a read-back.
- **Panel units** — the speed unit on the scooter's own display (dp 11, a BOOL):
  `0` = km/h, `1` = mph. Also on the **Ride** dashboard; independent of the
  app's speed unit, sent directly and verified with a read-back.
- **Auto-off time** — idle minutes before the scooter powers its radios off
  (dp 104, VALUE, range 5–90, default 60). Clamped to that range, stored per
  profile, and sent directly.
- **Credential** — importing your scooter's JSON from the Tuya IoT platform is
  the preferred way (there is a short step-by-step guide and a link to
  <https://iot.tuya.com/> right there). Manual `local_key` / `device_id` /
  `uuid` entry is still available as a fallback. **Export credentials & settings**
  downloads a JSON backup of every scooter profile (credentials, name filter,
  speed limits) plus the app settings (language, unit, speed warning, voice,
  announcement timings, arm state); importing that file restores both.

## Offline last-seen state

The scooter does **not** push its datapoints on its own, so on connect the app
now asks it for the full state (`requestStatus`, twice) — otherwise the
headlight / lock / gear controls would sit at “unknown” until the rider queried
manually. After every report the app debounces a snapshot of all known
datapoints to **IndexedDB** (`offline_state.js`, keyed per scooter profile).
When the app is not connected — on load, after a disconnect, or when you switch
profiles — it rebuilds the controls and fills them from that snapshot instead,
showing an “Offline — last seen …” note with the time the state was recorded.
The Debug **Dump datapoints (JSON)** export includes that timestamp too.

## Datapoint notes

Findings from comparing two **Dump datapoints (JSON)** exports taken before and
after a 12.5 km ride, plus a full 12:47 BLE capture:

- **dp 5 — trip distance.** Went `0` → `125` while the lifetime odometer
  (dp 12) went `24034` → `24159` — the same +125 delta. So dp 5 is the
  *current trip's* distance on the same ×10 scale as dp 12 (÷ 10 = km), reset
  between trips. Shown as the **Scooter trip** card.
- **dp 6 — trip time (seconds).** Went `0` → `2316` in the same interval;
  2316 s = 38.6 min over 12.5 km is a believable **19.4 km/h** average, and it
  was `0` alongside dp 5 at the trip's start. No other unit fits (minutes ≫
  trip, ×10 of seconds too slow, and it is neither distance nor remaining
  range). Shown as the **Scooter time** card (`m:ss`). *Assumed* — a controlled
  10-minute ride should advance it by ~600 to confirm.
- **dp 13 — assumed cruise control.** A BOOL that was `true` in **every** sample
  (both dumps; 10/10 reports in the capture) even while parked and locked. With
  no transition to observe, the meaning is inferred: a persistent setting like
  *cruise control enabled* fits best (not a live state such as “cruise active”,
  which would read false at rest, and not charging — the rider was moving). It
  is exposed on Ride as the **“Cruise?”** toggle; the trailing “?” marks it as
  the one control we are not yet sure about. Note (2026-10-18): the official
  Tuya app *has* a cruise toggle, but it also **fails to change cruise** on this
  scooter — the same pattern as the lock (dp 1), whose remote writes are
  acknowledged but not applied. So dp 13 is still plausibly cruise with firmware
  that ignores the write; distinguishing that from cruise living on a different
  (write-only) datapoint needs an HCI capture of the official app while toggling
  it. Tapping our toggle and checking the read-back line shows whether the write
  is applied at all.
- **dp 24 = 2540** was constant across both dumps and the whole capture — a
  fixed config/limit value, not a live measurement; left unlabelled.

## Safety

Sending is **armed by default** (remembered across sessions); the raw Debug
controls show a confirmation before each send, while the Ride / Settings controls
send directly, and you can turn sending off in Debug — the library then
refuses datapoint writes while `allowWrites` is false. This scooter is Tuya BLE
**v4**; because neither reference project sends v4 datapoints, verify a harmless
datapoint (e.g. the light) before trusting any DP that can affect motion.

## Protocol note

`tuya_ble.js` implements the *classic* Tuya BLE handshake (security flags 4/5,
session key = `md5(login_key[0:6] + srand)`), i.e. exactly the scheme used by
`ha_tuya_ble`/`tuya_ble`. Two GATT generations are auto-detected: **v3**
(`0xa201`, `2b10`/`2b11`, 1-byte DP length) and **v4** (`0xfd50`, chars
`…0001`/`…0002`, device-info `[0x00,0xF3]`, 2-byte DP length). Newer firmware
that uses the "secure V2" scheme (security modes 11–16, as in
`../TuyaOpen/src/tuya_cloud_service/ble/`) is not implemented; this scooter does
not need it.

### v4 datapoint writes — the header that makes the scooter act

A v4 DP write (`0x0027`) is **not** the bare KLV list. The firmware
(`tuya_ble_handle_dp_data_write_req`) requires a **5-byte header** first:

```
[0]     version   must be 0x00   (else "cmd dp write version not support")
[1..4]  sn        uint32 BE      (echoed back in the ack)
[5..]   KLV list  dp_id, dtype, len(2 BE), value
```

The device then answers `0x0027` with `header(5) | status(1)`, where status
`0x00` = accepted and non-zero = rejected. Sending the bare KLV (no header) is
accepted at the BLE/session layer but never actuates the datapoint — the first
KLV byte is read as `version` and the write is refused with status `0x01`. This
is exactly why the lock (dp 1) and gear (dp 15) were acknowledged yet did
nothing. Framing source: `tuya-ble-v4/docs/protocol-v4.md` and
`ShonP40/Tuya-BLE` (`_build_ikphogdj_v4_scalar_data`), both verified against the
firmware SDK.

## Capturing the official app (HCI snoop)

> Superseded: the v4 write framing above was found from the Tuya firmware SDK /
> reference projects, so this capture is no longer required. It is kept as a
> fallback for future unknowns.

A v4 DP write is **acknowledged but not applied** (the device echoes a header +
status with code `0x0027` while the periodic report keeps the old value). To
learn what the official Tuya app does differently, record its Bluetooth traffic
and compare bytes:

1. Phone → Developer options → enable **Bluetooth HCI snoop log**; toggle
   Bluetooth off/on.
2. Open the official app, connect, lock/unlock (and change gear), then close it.
3. Pull the log — either
   `adb pull /data/misc/bluetooth/logs/btsnoop_hci.log` (needs root), or take a
   bug report (`adb bugreport bugreport.zip`) and extract
   `FS/data/misc/bluetooth/logs/btsnoop_hci.log`.
4. Decode it: `python3 tools/btsnoop_att.py btsnoop_hci.log` lists every ATT
   Write/Notify value in order (`>` = app→scooter, `<` = scooter→app).

The GATT payloads are the *encrypted* Tuya frames (`flag | iv(16) | AES-CBC`),
but the framing is recoverable: our session key is `md5(local_key[:6] + srand)`
and this scooter's `local_key` is empty, so the plaintext can be decrypted from
the `srand` in the device-info response.
