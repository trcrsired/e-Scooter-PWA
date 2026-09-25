#!/usr/bin/env python3
"""Fetch Tuya BLE device credentials from Tuya OpenAPI -> keys.json.

Mirrors what the ha_tuya_ble Home Assistant integration does:
  - list devices bound to the app account linked to your IoT project
  - fetch device detail (uuid, local_key, product_id, category)
  - fetch factory info (mac, uuid) for BLE devices
  - fetch the DP specification (function/status maps) for reference

Setup:
  python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt

Config via environment (see .env.example):
  TUYA_ENDPOINT      e.g. https://openapi.tuyaeu.com  (must match the
                     region where your app account lives:
                     us -> tuyaus.com, eu -> tuyaeu.com, cn -> tuyacn.com,
                     in -> tuyain.com)
  TUYA_ACCESS_ID     IoT project access id  (iot.tuya.com -> Cloud -> your project)
  TUYA_ACCESS_SECRET IoT project access secret
  TUYA_USERNAME      Tuya Smart / Smart Life account (email or phone)
  TUYA_PASSWORD      App account password
  TUYA_COUNTRY_CODE  e.g. "49", "1", "86" (account country, no '+')
  TUYA_SCHEMA        "tuyaSmart" (Tuya Smart app) or "smartlife" (Smart Life app)
  TUYA_DEVICE_ID     optional: fetch just this device

Usage:
  .venv/bin/python tools/fetch_keys.py            # all linked devices
"""

import json
import os
import sys
import time

try:
    from tuya_iot import TuyaOpenAPI
except ImportError:
    sys.exit(
        "tuya-iot-py-sdk not installed. Run:\n"
        "  python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt"
    )

OUT_FILE = os.path.join(os.path.dirname(__file__), "..", "keys.json")


def env(name, default=""):
    v = os.environ.get(name, default)
    if not v and name != "TUYA_DEVICE_ID":
        sys.exit(f"missing env var {name} (see .env.example)")
    return v


def api_get(api, url):
    resp = api.get(url)
    if not resp.get("success"):
        raise RuntimeError(f"{url} -> {resp}")
    return resp.get("result")


def main():
    api = TuyaOpenAPI(env("TUYA_ENDPOINT"), env("TUYA_ACCESS_ID"), env("TUYA_ACCESS_SECRET"))
    username = os.environ.get("TUYA_USERNAME", "")
    if username:
        api.connect(
            username,
            env("TUYA_PASSWORD"),
            env("TUYA_COUNTRY_CODE"),
            env("TUYA_SCHEMA", "tuyaSmart"),
        )
    else:
        api.connect()

    device_ids = [env("TUYA_DEVICE_ID")] if os.environ.get("TUYA_DEVICE_ID") else []
    if not device_ids:
        result = api_get(api, "/v1.0/iot-01/associated-users/devices?size=100")
        device_ids = [d["id"] for d in result.get("devices", [])]
        if not device_ids:
            sys.exit("no devices linked to the project — link your app account "
                     "in the IoT console (Devices -> Link App Account) or set TUYA_DEVICE_ID")

    out = {"fetched_at": int(time.time()), "devices": {}}
    for dev_id in device_ids:
        dev = api_get(api, f"/v1.0/devices/{dev_id}") or {}
        entry = {
            "device_id": dev_id,
            "device_name": dev.get("name", ""),
            "uuid": dev.get("uuid", ""),
            "local_key": dev.get("local_key", ""),
            "product_id": dev.get("product_id", ""),
            "product_name": dev.get("product_name", ""),
            "category": dev.get("category", ""),
            "ip": dev.get("ip", ""),
        }

        try:
            factory = api_get(api, f"/v1.0/iot-03/devices/factory-infos?device_ids={dev_id}")
            if factory:
                entry["mac"] = factory[0].get("mac", "")
                entry["sn"] = factory[0].get("sn", "")
        except RuntimeError as e:
            print(f"warn: factory-infos for {dev_id}: {e}", file=sys.stderr)

        try:
            spec = api_get(api, f"/v1.0/devices/{dev_id}/specifications")
            if spec:
                entry["functions"] = spec.get("functions", [])
                entry["status"] = spec.get("status", [])
        except RuntimeError as e:
            print(f"warn: specifications for {dev_id}: {e}", file=sys.stderr)

        out["devices"][dev_id] = entry
        print(f"{dev_id}: {entry['device_name']} "
              f"(product={entry['product_id']}, category={entry['category']})")

    with open(OUT_FILE, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"\nwrote {os.path.abspath(OUT_FILE)} ({len(out['devices'])} device(s))")


if __name__ == "__main__":
    main()
