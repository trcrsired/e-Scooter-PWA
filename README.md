# E-Scooter-PWA

A **GPLv3** free-software Progressive Web App (PWA) that talks directly to a
**Tuya BLE electric scooter** from the browser — no cloud account, no server, no
vendor app. Your credentials and data stay on your device.

The goal: ride with a phone mounted on the handlebars and get a clean
speedometer, spoken speed call-outs, a speed warning, and a way to switch ride
mode — while still having a raw "Debug" view when you want to poke at the
scooter's datapoints.

## What it does

- **Ride dashboard** — a big GPS-speed hero with trip / max / average / elapsed
  time, unit toggle (**km/h · mph · m/s**) and live scooter read-outs (battery,
  voltage, temperature, total distance).
- **Voice announcements** — optional spoken speed every *N* seconds, with a
  choice of any speech voice the browser offers.
- **Speed warning** — flash/vibrate/toast when you go faster than a limit you
  set.
- **Ride-mode switch** — 🚶 Walk / 🍃 Eco / 🛴 D / ⚡ S, straight from the main UI.
- **Lock & headlight** — 🔒 Locked / 🔓 Unlocked (dp 1) and 💡 On / 🔌 Off
  (dp 8) right on the Ride dashboard; it nags you to switch the headlight on
  when you connect after dark (18:00–06:00).
- **Speed limits** — set the Eco / D / S maximum speed (km/h) in Settings
  (datapoints 101 / 102 / 103), each with an editable allowed range.
- **Start mode** — choose how the scooter pulls away (dp 16): start directly on
  the throttle, or run/push to start.
- **Auto-off time** — how long the scooter stays on when idle before going
  offline (dp 104, 5–90 minutes, default 60).
- **Debug view** — the raw datapoint controls, a manual datapoint sender, a
  button to dump every known datapoint to a timestamped JSON file, and a
  diagnostics log.
- **Multiple scooters** — keep a list of profiles and switch between them in the
  UI; each profile can filter the Bluetooth chooser by device-name prefix.
- **Offline last-seen state** — the last values each scooter reported are kept in
  the browser (IndexedDB), so when you are not connected the dashboard still
  shows them, labelled with the time they were last seen.
- **Backup** — export every scooter (credentials, name filter, speed limits) plus
  your app settings to one JSON file, and import it back on another device.

## Why

Tuya scooters are normally only controllable through the vendor app and the
Tuya cloud. This project instead speaks the local **BLE protocol** from the
browser (Web Bluetooth), so it works offline, keeps your `local_key` in
`localStorage`, and can show you the data the official app hides.

It was written for a Tuya BLE **v4** scooter (YFS-Z1 / AOVO class), but it also
implements the older **v3** GATT generation.

## Quick start

```
cd source && python3 -m http.server 8080      # serve the PWA
```

Web Bluetooth needs a **secure context** — `localhost`, an `adb reverse` tunnel,
or HTTPS. Then:

1. Open the page in Chrome/Edge on Android or desktop.
2. Tap **Connect to scooter** and pick your scooter.
3. Open **Settings → Credential** and either **load your scooter's JSON** from
   the Tuya IoT platform (<https://iot.tuya.com/> — there's a step-by-step guide
   in the app) or enter `local_key` / `device_id` / `uuid` by hand.

Sending commands is armed by default, and every send still asks for
confirmation.

## Safety

Confirmed commands really go to the scooter and **can unlock, move or change the
speed** of a vehicle. Only send datapoints you understand, and disconnect first
when in doubt. See the notice in the Debug view.

## Documentation

- [`implementation.md`](implementation.md) — what's in each directory, features
  in detail, and how to run/develop it.
- [`how-it-works.md`](how-it-works.md) — the reverse-engineered Tuya BLE
  protocol notes.

## License

GPLv3 — see [`LICENSE`](LICENSE).
