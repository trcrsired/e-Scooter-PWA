#!/usr/bin/env bash
# Capture the OFFICIAL Tuya/Smart Life app's Bluetooth traffic and decode it.
#
# Run this on the machine the phone is plugged into (USB debugging on):
#     tools/capture_snoop.sh
#
# It enables the HCI snoop log, restarts Bluetooth, waits for you to do the
# lock/unlock in the official app, then pulls the log (via root if available,
# otherwise via a bug report) and runs tools/tuya_snoop_decode.py.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-btsnoop_hci.log}"

if ! adb get-state >/dev/null 2>&1; then
  echo "No adb device. Plug the phone in, turn on USB debugging, accept the prompt."
  exit 1
fi

echo "== enabling Bluetooth HCI snoop log (best effort) =="
adb shell settings put secure bluetooth_hci_log 1 >/dev/null 2>&1 || true
adb shell settings put global bluetooth_hci_log 1 >/dev/null 2>&1 || true
echo "   secure=$(adb shell settings get secure bluetooth_hci_log 2>/dev/null | tr -d '\r')"
echo "   global=$(adb shell settings get global bluetooth_hci_log 2>/dev/null | tr -d '\r')"
echo "   (if both show 'null'/0, enable it manually: Developer options -> 'Bluetooth HCI snoop log' -> Enabled)"

echo "== restarting Bluetooth so snooping starts =="
adb shell svc bluetooth disable >/dev/null 2>&1 || true
sleep 2
adb shell svc bluetooth enable  >/dev/null 2>&1 || true
sleep 3

cat <<'EOF'

--------------------------------------------------------------------------
Now reproduce in the OFFICIAL app (make sure our PWA is disconnected):
  1. open Tuya / Smart Life, connect to the scooter
  2. LOCK it, wait ~2s, UNLOCK it
  3. change the gear (walk/eco/d/s), toggle a light if present
  4. disconnect / close the app
--------------------------------------------------------------------------
EOF
read -r -p "Press ENTER when done: " _

echo "== fetching the log =="
if adb pull /data/misc/bluetooth/logs/btsnoop_hci.log "$OUT" 2>/dev/null && [ -s "$OUT" ]; then
  echo "pulled (root): $OUT"
else
  echo "no direct access -> taking a bug report (no root needed; may take a minute)"
  rm -rf bugreport.zip bugreport_extract
  adb bugreport bugreport.zip
  unzip -o bugreport.zip 'FS/data/misc/bluetooth/logs/btsnoop_hci.log' -d bugreport_extract >/dev/null 2>&1 || \
    unzip -o bugreport.zip -d bugreport_extract >/dev/null 2>&1
  SNOOP="$(find bugreport_extract -name 'btsnoop_hci.log' 2>/dev/null | head -1)"
  if [ -n "$SNOOP" ]; then
    cp "$SNOOP" "$OUT"; echo "extracted from bug report: $OUT"
  else
    echo "could not find btsnoop_hci.log in the bug report."; exit 1
  fi
fi

echo "== decoding =="
python3 "$HERE/tuya_snoop_decode.py" "$OUT" | tee snoop_decoded.txt
echo
echo "Saved: $OUT and snoop_decoded.txt — send me both (or just the .log)."
