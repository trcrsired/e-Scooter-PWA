#!/usr/bin/env python3
"""Scan for the scooter from a Windows PC (bleak / WinRT).

    python win_ble_scan.py [name_prefix]

Prints any device whose advertised name matches the prefix, any device that
advertises the Tuya v4 service 0xFD50, and a short summary of everything seen
(with the manufacturer data, which is where Tuya hides the product key).
"""
import asyncio
import sys

from bleak import BleakScanner


async def main():
    prefix = (sys.argv[1] if len(sys.argv) > 1 else "demo").lower()
    print(f"scanning 10s (looking for name~{prefix!r} or service 0xfd50)…")
    found = await BleakScanner.discover(timeout=10.0, return_adv=True)
    matches = []
    for addr, (dev, adv) in found.items():
        name = dev.name or adv.local_name or ""
        svcs = [str(u).lower() for u in adv.service_uuids]
        hit_name = prefix in name.lower()
        hit_svc = any("fd50" in s or "a201" in s for s in svcs)
        mfg = {k: bytes(v).hex() for k, v in (adv.manufacturer_data or {}).items()}
        if hit_name or hit_svc:
            matches.append((addr, name, adv.rssi, svcs, mfg))
    print(f"--- {len(found)} devices seen, {len(matches)} match ---")
    for addr, name, rssi, svcs, mfg in matches:
        print(f"MATCH {addr}  name={name!r}  rssi={rssi}")
        print(f"      services={svcs}")
        print(f"      manufacturer={mfg}")
    if not matches:
        print("no match; full list:")
        for addr, (dev, adv) in list(found.items())[:30]:
            name = dev.name or adv.local_name or ""
            print(f"  {addr}  {name!r}  rssi={adv.rssi}")


if __name__ == "__main__":
    asyncio.run(main())
