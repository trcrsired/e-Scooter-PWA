# E-Scooter-PWA
a GPLv3 free software of PWA for e-scooter

- `source/` — the PWA itself; serve this directory (`python3 -m http.server`)
- `cpp/` — `tuya_crypto.cpp`, built to `source/tuya_crypto.wasm` with
  clang + fast_io (see comment in the file)
- `tools/` — `fetch_keys.py` pulls device credentials from Tuya OpenAPI
- `how-it-works.md` — protocol analysis notes
