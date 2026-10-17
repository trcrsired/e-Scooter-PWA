#!/usr/bin/env python3
"""Build a synthetic btsnoop that mimics a Tuya BLE v4 session, to test the
decoder without hardware. Mirrors source/tuya_ble.js byte-for-byte:
  frame = seq(4) | response_to(4) | code(2) | len(2) | data | crc16(2)
  payload = flag(1) | iv(16) | AES-128-CBC(padded frame)
  subpackets: varint(num)[, varint(total_len), proto_byte if num==0] | chunk
"""
import hashlib
import os
import struct

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

WRITE_H = 0x0011
NOTIFY_H = 0x0012
PROTO_BYTE = 0x40  # protocol_version 4 << 4


def crc16(buf):
    crc = 0xFFFF
    for b in buf:
        crc ^= b
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    return crc & 0xFFFF


def aes_cbc_enc(key, iv, data):
    enc = Cipher(algorithms.AES(key[:16]), modes.CBC(iv)).encryptor()
    return enc.update(data) + enc.finalize()


def frame(seq, resp, code, data):
    head = struct.pack(">IIHH", seq, resp, code, len(data)) + data
    return head + struct.pack(">H", crc16(head))


def encrypt(key, flag, plain):
    pad = (16 - len(plain) % 16) % 16
    plain = plain + b"\x00" * pad
    iv = os.urandom(16)
    return bytes([flag]) + iv + aes_cbc_enc(key, iv, plain)


def subpackets(payload, mtu=20):
    out, pos, num = [], 0, 0
    while pos < len(payload):
        hdr = varint(num)
        if num == 0:
            hdr += varint(len(payload)) + bytes([PROTO_BYTE])
        n = max(1, mtu - len(hdr))
        out.append(hdr + payload[pos:pos + n])
        pos += n
        num += 1
    return out


def varint(v):
    out = b""
    while True:
        b = v & 0x7F
        v >>= 7
        out += bytes([b | (0x80 if v else 0)])
        if not v:
            return out


def h4_acl(chunks, h4type=0x02):
    """Wrap each ATT value into its own ACL packet (PB=0b10 complete)."""
    out = b""
    for c in chunks:
        l2 = struct.pack("<HH", len(c), 0x0004) + c
        out += bytes([h4type]) + struct.pack("<H", 0x0002 | (0x2 << 12)) \
            + struct.pack("<H", len(l2)) + l2
    return out


def rec(dirflag, h4):
    return struct.pack(">IIIIq", len(h4), len(h4), dirflag, 0, 0) + h4


def att(op, handle, value):
    return bytes([op]) + struct.pack("<H", handle) + value


def main():
    local_key = ""
    klogin = hashlib.md5(local_key[:6].encode()).digest()
    srand = bytes.fromhex("1617701e7aa0")
    ksession = hashlib.md5(local_key[:6].encode() + srand).digest()
    auth = bytes(range(16)) * 2

    # device-info response (code 0) contents
    di = bytearray(46)
    di[0:2] = b"\x02\x01"
    di[2:4] = b"\x04\x04"
    di[4] = 0x05
    di[5] = 0x01
    di[6:12] = srand
    di[14:46] = auth

    # app -> scooter
    sent = []
    sent += subpackets(encrypt(klogin, 4, frame(1, 0, 0x0000, bytes([0x00, 0xf3]))))
    sent += subpackets(encrypt(ksession, 5, frame(2, 0, 0x0001, b"\x00")))
    sent += subpackets(encrypt(ksession, 5, frame(3, 0, 0x0003, b"")))
    # the lock write: dp 1 (BOOL) = 0
    sent += subpackets(encrypt(ksession, 5, frame(4, 0, 0x0027, bytes([1, 1, 0, 1, 0]))))

    # scooter -> app
    recv = []
    recv += subpackets(encrypt(klogin, 4, frame(1, 1, 0x0000, bytes(di))))
    recv += subpackets(encrypt(ksession, 5, frame(2, 2, 0x0001, b"\x02")))
    recv += subpackets(encrypt(ksession, 5, frame(3, 3, 0x0003, b"\x00")))
    # ack echo of the write
    recv += subpackets(encrypt(ksession, 5, frame(4, 4, 0x0027, bytes([1, 1, 0, 1, 0, 1]))))
    # a real report: 7-byte header + dp 1 = true
    hdr = struct.pack(">IBBB", 9, 0, 0, 0)
    recv += subpackets(encrypt(ksession, 5, frame(5, 0, 0x8006, hdr + bytes([1, 1, 0, 1, 1]))))

    blob = b"btsnoop\x00" + struct.pack(">II", 1, 1002)
    for c in sent:
        blob += rec(0, h4_acl([att(0x52, WRITE_H, c)]))
    for c in recv:
        blob += rec(1, h4_acl([att(0x1B, NOTIFY_H, c)]))
    out = sys.argv[1] if len(sys.argv) > 1 else "fake_snoop.log"
    open(out, "wb").write(blob)
    print(f"wrote {out} ({len(blob)} bytes), session_key={ksession.hex()}")


if __name__ == "__main__":
    import sys
    main()
