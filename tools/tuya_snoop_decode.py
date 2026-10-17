#!/usr/bin/env python3
"""Decode + decrypt Tuya BLE traffic captured from the official app.

    python3 tuya_snoop_decode.py btsnoop_hci.log [local_key]

Why this works for this scooter: the Tuya BLE transport encrypts each frame as
`flag(1) | iv(16) | AES-128-CBC(seq(4) | response_to(4) | code(2) | len(2) |
data | crc16(2))`, keyed by a security flag:
    flag 1 -> auth_key      (sent plaintext inside the device-info response)
    flag 4 -> login_key     = md5(local_key[:6])
    flag 5 -> session_key   = md5(local_key[:6] + srand)
`srand` (6 bytes) also rides inside the device-info response, so once we decrypt
that one frame the whole session falls open.  This scooter's local_key is empty,
so login_key = md5(b"") and session_key = md5(srand).
"""
import hashlib
import struct
import sys

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

import btsnoop_att

SEC_NONE, SEC_AUTH, SEC_LOGIN, SEC_SESSION = 0, 1, 4, 5

CODE = {
    0x0000: "DEVICE_INFO",
    0x0001: "PAIR",
    0x0002: "DPS(v3)",
    0x0003: "DEVICE_STATUS",
    0x0027: "DPS(v4)",
    0x8001: "RECV_DP",
    0x8003: "RECV_TIME_DP",
    0x8004: "RECV_SIGN_DP",
    0x8005: "RECV_SIGN_TIME_DP",
    0x8006: "RECV_DP_V4",
    0x8007: "RECV_TIME_DP_V4",
    0x8011: "TIME1_REQ",
    0x8012: "TIME2_REQ",
}
DT = {0: "RAW", 1: "BOOL", 2: "VALUE", 3: "STRING", 4: "ENUM", 5: "BITMAP"}


def unpack_varint(b, pos):
    result, shift = 0, 0
    while True:
        if pos >= len(b):
            raise ValueError("varint overrun")
        x = b[pos]
        pos += 1
        result |= (x & 0x7F) << shift
        if not (x & 0x80):
            return result, pos
        shift += 7
        if shift > 35:
            raise ValueError("varint too long")


def aes_cbc(key, iv, data):
    dec = Cipher(algorithms.AES(key[:16]), modes.CBC(iv)).decryptor()
    return dec.update(data) + dec.finalize()


def reassemble(chunks):
    """chunks: list of raw ATT values, in wire order, one direction.
    Yields complete encrypted payloads (flag|iv|ct)."""
    buf, expect_len, expect_num, num = [], None, 0, None
    for raw in chunks:
        try:
            num, pos = unpack_varint(raw, 0)
        except ValueError:
            continue
        if num == 0:
            buf = []
            try:
                expect_len, pos = unpack_varint(raw, pos)
            except ValueError:
                continue
            if pos >= len(raw):
                continue
            pos += 1  # transport version byte
            expect_num = 0
        if expect_len is None or num != expect_num:
            buf, expect_len, expect_num = [], None, 0
            continue
        buf.append(raw[pos:])
        expect_num += 1
        total = sum(len(c) for c in buf)
        if total == expect_len:
            yield b"".join(buf)
            buf, expect_len, expect_num = [], None, 0
        elif total > expect_len:
            buf, expect_len, expect_num = [], None, 0


def decrypt_frame(payload, key):
    flag = payload[0]
    iv, ct = payload[1:17], payload[17:]
    if len(ct) % 16:
        return None
    raw = aes_cbc(key, iv, ct)
    seq, resp, code, length = struct.unpack(">IIHH", raw[:12])
    if 12 + length + 2 > len(raw):
        return None
    return flag, seq, resp, code, raw[12:12 + length]


def parse_dps(data, len_size, start):
    out, pos = [], start
    need = 2 + len_size
    while len(data) - pos >= need:
        pid = data[pos]
        dt = data[pos + 1]
        if dt > 5:
            break
        ln = int.from_bytes(data[pos + 2:pos + 2 + len_size], "big")
        vpos = pos + 2 + len_size
        if vpos + ln > len(data):
            break
        val = data[vpos:vpos + ln]
        if dt == 1:
            v = int.from_bytes(val, "big") != 0
        elif dt in (2, 4):
            v = int.from_bytes(val, "big", signed=True)
        elif dt in (0, 5):
            v = val.hex()
        else:
            v = val.decode("latin1")
        out.append((pid, DT.get(dt, dt), v))
        pos = vpos + ln
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    local_key = sys.argv[2] if len(sys.argv) > 2 else ""
    key_login = hashlib.md5(local_key[:6].encode("latin1")).digest()

    # Collect ordered ATT writes (>) and notifications (<), keyed by handle.
    sent, recv = [], []
    for ts, direction, handle, att in btsnoop_att.iter_acl(
            btsnoop_att.parse_btsnoop(sys.argv[1])):
        if not att:
            continue
        op = att[0]
        if op in (btsnoop_att.ATT_WRITE_CMD, btsnoop_att.ATT_WRITE_REQ):
            sent.append(att[3:])
        elif op in (btsnoop_att.ATT_NOTIFY, btsnoop_att.ATT_INDICATE):
            recv.append(att[3:])

    enc = [(">", p) for p in reassemble(sent)] + \
          [("<", p) for p in reassemble(recv)]

    # Pass 1: find srand + auth_key in the (login-encrypted) device info.
    srand = auth_key = None
    for d, p in enc:
        if p[0] != SEC_LOGIN:
            continue
        f = decrypt_frame(p, key_login)
        if f and f[3] == 0x0000 and len(f[4]) >= 46:
            srand = f[4][6:12]
            auth_key = f[4][14:46]
    key_session = hashlib.md5(local_key[:6].encode("latin1") + srand).digest() if srand else None
    sys.stderr.write(
        f"messages={len(enc)} srand={srand.hex() if srand else '?'} "
        f"session_key={key_session.hex() if key_session else '?'}\n")

    for d, p in enc:
        flag = p[0]
        if flag == SEC_LOGIN:
            key = key_login
        elif flag == SEC_SESSION:
            key = key_session
        elif flag == SEC_AUTH:
            key = auth_key
        else:
            print(f"{d} flag={flag} (unknown, {len(p)}B)"); continue
        if key is None:
            print(f"{d} flag={flag} (waiting for key, {len(p)}B)"); continue
        f = decrypt_frame(p, key)
        if not f:
            print(f"{d} flag={flag} DECRYPT/FRAME ERROR"); continue
        _, seq, resp, code, data = f
        name = CODE.get(code, hex(code))
        print(f"{d} #{seq}->{resp} {name:14s} len={len(data):3d}  {data.hex(' ')}")
        for start, ls in ((0, 2), (7, 2), (0, 1)):
            dps = parse_dps(data, ls, start)
            if dps:
                print(f"      dps(start={start},len={ls}): " +
                      ", ".join(f"{i}:{t}={v}" for i, t, v in dps))
                break


if __name__ == "__main__":
    main()
