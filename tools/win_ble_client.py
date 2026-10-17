#!/usr/bin/env python3
"""Tuya BLE v4 client for a Windows PC (bleak), mirroring source/tuya_ble.js.

    python win_ble_client.py probe   DC:23:51:55:D8:BC
    python win_ble_client.py variants DC:23:51:55:D8:BC
    python win_ble_client.py send    DC:23:51:55:D8:BC <dp_id> <type> <value> [--code HEX] [--hdr]

`probe`    connects, runs the handshake, prints the device-info blob and every
           datapoint for a few seconds.
`variants` sends a gear write several different ways and reports whether the
           read-back actually changed (to find the encoding this scooter obeys).
`send`     one raw datapoint write.

No third-party crypto: uses tools/pure_aes.py.
"""
import asyncio
import hashlib
import os
import struct
import sys
import time

from bleak import BleakClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pure_aes  # noqa: E402

WRITE_V4 = "00000001-0000-1001-8001-00805f9b07d0"
NOTIFY_V4 = "00000002-0000-1001-8001-00805f9b07d0"
MTU = 20

DEVICE_INFO_PAYLOAD_V4 = bytes([0x00, 0xF3])
CODE = {0x0000: "DEVICE_INFO", 0x0001: "PAIR", 0x0002: "DPS(v3)", 0x0003: "DEVICE_STATUS",
        0x0027: "DPS(v4)", 0x8001: "RECV_DP", 0x8003: "RECV_TIME_DP", 0x8004: "RECV_SIGN_DP",
        0x8005: "RECV_SIGN_TIME_DP", 0x8006: "RECV_DP_V4", 0x8007: "RECV_TIME_DP_V4",
        0x8011: "TIME1_REQ", 0x8012: "TIME2_REQ"}
DT = {0: "RAW", 1: "BOOL", 2: "VALUE", 3: "STRING", 4: "ENUM", 5: "BITMAP"}
SEC_LOGIN, SEC_SESSION = 4, 5

DEFAULT_CREDS = {"uuid": "92b31ed457e6b2fe", "deviceId": "ebf8c70b4693a5b4b2xpse", "localKey": ""}


def crc16(buf):
    crc = 0xFFFF
    for b in buf:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc & 0xFFFF


def varint(v):
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        out.append(b | (0x80 if v else 0))
        if not v:
            return bytes(out)


def unpack_varint(b, pos):
    result, shift = 0, 0
    while True:
        x = b[pos]
        pos += 1
        result |= (x & 0x7F) << shift
        if not (x & 0x80):
            return result, pos
        shift += 7


def encode_dp_value(dt, value):
    if dt == 1:
        return bytes([1 if value else 0])
    if dt == 2:
        return struct.pack(">i", int(value))
    if dt in (4, 5):
        v = int(value)
        if v > 0xFFFF:
            return struct.pack(">I", v & 0xFFFFFFFF)
        if v > 0xFF:
            return struct.pack(">H", v)
        return bytes([v & 0xFF])
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    return str(value).encode()


def encode_klv(dps, len_size):
    out = bytearray()
    for pid, dt, val in dps:
        v = encode_dp_value(dt, val)
        out += bytes([pid, dt]) + len(v).to_bytes(len_size, "big") + v
    return bytes(out)


def parse_klv(data, len_size, start):
    out, pos = [], start
    while len(data) - pos >= 2 + len_size:
        pid, dt = data[pos], data[pos + 1]
        if dt > 5:
            break
        ln = int.from_bytes(data[pos + 2:pos + 2 + len_size], "big")
        vpos = pos + 2 + len_size
        if vpos + ln > len(data):
            break
        raw = data[vpos:vpos + ln]
        if dt == 1:
            val = int.from_bytes(raw, "big") != 0
        elif dt in (2, 4):
            val = int.from_bytes(raw, "big", signed=True)
        elif dt in (0, 5):
            val = raw.hex()
        else:
            val = raw.decode("latin1")
        out.append((pid, DT.get(dt, dt), val))
        pos = vpos + ln
    return out


class TuyaBLE:
    def __init__(self, client, creds, proto=4):
        self.client = client
        self.creds = creds
        self.proto = proto
        self.seq = 1
        self.local_key = creds.get("localKey", "") or ""
        self.key_login = hashlib.md5(self.local_key[:6].encode("latin1")).digest()
        self.key_session = None
        self.key_auth = None
        self.pending = {}
        self.last_dps = {}
        self.raw_log = []
        self.verbose = True
        self.rx = None
        self.write_resp = os.environ.get("TUYA_WRITE_RESP", "") == "1"
        self.mtu = int(os.environ.get("TUYA_MTU", "20"))

    def log(self, msg):
        print(msg, flush=True)

    # ---- crypto / framing ----
    def _key_for(self, code):
        if code == 0x0000:
            return self.key_login, SEC_LOGIN
        return self.key_session, SEC_SESSION

    def _build_packets(self, seq, code, data, response_to=0):
        key, flag = self._key_for(code)
        if not key:
            raise RuntimeError(f"no key for code {code:#x}")
        raw = struct.pack(">IIHH", seq, response_to, code, len(data)) + data
        raw += struct.pack(">H", crc16(raw))
        pad = (16 - len(raw) % 16) % 16
        plain = raw + b"\x00" * pad
        iv = os.urandom(16)
        payload = bytes([flag]) + iv + pure_aes.cbc_encrypt(key, iv, plain)
        out, pos, num = [], 0, 0
        while pos < len(payload):
            hdr = varint(num)
            if num == 0:
                hdr += varint(len(payload)) + bytes([(self.proto << 4) & 0xFF])
            n = max(1, self.mtu - len(hdr))
            out.append(hdr + payload[pos:pos + n])
            pos += n
            num += 1
        return out

    async def send(self, code, data, response_to=0, wait=True, timeout=8.0, write_response=None):
        if write_response is None:
            write_response = self.write_resp
        seq = self.seq
        self.seq += 1
        packets = self._build_packets(seq, code, data, response_to)
        if self.verbose:
            self.log(f">> code={code:#x} seq={seq} resp_to={response_to} "
                     f"{len(packets)} pkt(s), resp={write_response}: " +
                     " | ".join(p.hex(" ") for p in packets))
        fut = None
        if wait:
            fut = asyncio.get_event_loop().create_future()
            self.pending[seq] = fut
        for p in packets:
            await self.client.write_gatt_char(WRITE_V4, p, response=write_response)
        if not wait:
            return None
        try:
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            self.pending.pop(seq, None)
            raise RuntimeError(f"timeout waiting for response to {code:#x}")

    # ---- inbound ----
    def on_notify(self, _sender, data):
        b = bytes(data)
        self.raw_log.append(b)
        if self.verbose:
            self.log(f"<< notify [{len(b)}] {b.hex(' ')}")
        try:
            self._reassemble(b)
        except Exception as e:
            self.log(f"rx error: {e}")

    def _reassemble(self, buf):
        self.rx = getattr(self, "rx", None)
        if self.rx is None:
            self.rx = {"buf": [], "len": None, "num": 0}
        num, pos = unpack_varint(bytes(buf), 0)
        st = self.rx
        if num == 0:
            st["buf"] = []
            st["len"], pos = unpack_varint(bytes(buf), pos)
            pos += 1
            st["num"] = 0
        if num != st["num"]:
            self.rx = {"buf": [], "len": None, "num": 0}
            return
        st["buf"].append(bytes(buf)[pos:])
        st["num"] += 1
        total = sum(len(x) for x in st["buf"])
        if st["len"] is not None and total >= st["len"]:
            full = b"".join(st["buf"])
            self.rx = {"buf": [], "len": None, "num": 0}
            self._parse_input(full)

    def _key_of_flag(self, flag):
        if flag == 1:
            return self.key_auth
        if flag == 4:
            return self.key_login
        if flag == 5:
            return self.key_session
        return None

    def _parse_input(self, buf):
        flag = buf[0]
        key = self._key_of_flag(flag)
        if not key:
            self.log(f"rx flag {flag} without key")
            return
        raw = pure_aes.cbc_decrypt(key, buf[1:17], buf[17:])
        seq, resp, code, length = struct.unpack(">IIHH", raw[:12])
        if 12 + length + 2 > len(raw):
            self.log("rx short frame")
            return
        if crc16(raw[:12 + length]) != struct.unpack(">H", raw[12 + length:14 + length])[0]:
            self.log("rx CRC mismatch")
            return
        data = raw[12:12 + length]
        self._handle(seq, resp, code, data)

    def _handle(self, seq, resp, code, data):
        name = CODE.get(code, hex(code))
        if code == 0x0000 and len(data) >= 14:
            self.proto = data[2] or self.proto
            srand = data[6:12]
            self.key_session = hashlib.md5(self.local_key[:6].encode("latin1") + srand).digest()
            if len(data) >= 46:
                self.key_auth = data[14:46][:16]
            self.log(f"<= DEVICE_INFO len={len(data)} proto_version={data[2]} "
                     f"bound={data[5] != 0} srand={srand.hex()}")
            self.log("   full: " + data.hex(" "))
        elif code == 0x8006:
            dps = parse_klv(data, 2, 7)
            self._note_dps("REPORT v4", dps)
        elif code == 0x0027:
            self.log(f"<= DPS(v4) echo len={len(data)}: {data.hex(' ')}  " +
                     ", ".join(f"{i}:{t}={v}" for i, t, v in parse_klv(data, 2, 0)))
        elif code == 0x8001:
            self._note_dps("REPORT v3", parse_klv(data, 1, 0))
        else:
            self.log(f"<= {name} len={len(data)}: {data.hex(' ')}")
        if resp:
            fut = self.pending.pop(resp, None)
            if fut and not fut.done():
                fut.set_result((seq, code, data))

    def _note_dps(self, tag, dps):
        if not dps:
            return
        self.log(f"<= {tag}: " + ", ".join(f"{i}:{t}={v}" for i, t, v in dps))
        for i, t, v in dps:
            self.last_dps[i] = v

    # ---- handshake ----
    async def handshake(self):
        info = await self.send(0x0000, DEVICE_INFO_PAYLOAD_V4,
                               timeout=float(os.environ.get("TUYA_TIMEOUT", "20")))
        if not self.key_session:
            raise RuntimeError("no session key derived")
        login = self.local_key[:6].encode("latin1")
        payload = (self.creds["uuid"].encode() + login + self.creds["deviceId"].encode())[:44]
        payload = payload.ljust(44, b"\x00")
        res = await self.send(0x0001, payload, timeout=8)
        code = res[2][0] if res and res[2] else 0
        self.log(f"paired (result={code})")
        await self.send(0x0003, b"", wait=False)
        return info


async def with_client(addr, fn):
    from bleak import BleakScanner
    print(f"scanning for {addr}…", flush=True)
    dev = await BleakScanner.find_device_by_address(addr, timeout=20.0)
    if dev is None:
        raise RuntimeError(f"device {addr} not found in scan")
    print(f"found {dev.name!r}; connecting…", flush=True)
    async with BleakClient(dev, timeout=25.0) as client:
        print(f"connected={client.is_connected} mtu={getattr(client, 'mtu_size', 'n/a')}", flush=True)
        t = TuyaBLE(client, DEFAULT_CREDS)
        await client.start_notify(NOTIFY_V4, t.on_notify)
        await asyncio.sleep(0.6)
        try:
            await t.handshake()
            await fn(t)
        finally:
            try:
                await client.stop_notify(NOTIFY_V4)
            except Exception:
                pass


async def cmd_listen(addr):
    async with BleakClient(addr, timeout=20.0) as client:
        print(f"connected={client.is_connected}", flush=True)
        if os.environ.get("TUYA_PAIR") == "1":
            try:
                await client.pair()
                print("pair(): ok", flush=True)
            except Exception as e:
                print(f"pair(): {type(e).__name__}: {e}", flush=True)
        await client.start_notify(NOTIFY_V4, lambda s, d: print("<< " + bytes(d).hex(" "), flush=True))
        try:
            cccd = await client.read_gatt_descriptor(19)
            print(f"CCCD(handle 19) after start_notify = {bytes(cccd).hex()}", flush=True)
            if bytes(cccd) != b"\x01\x00":
                await client.write_gatt_descriptor(19, b"\x01\x00")
                cccd = await client.read_gatt_descriptor(19)
                print(f"CCCD(handle 19) after force-write = {bytes(cccd).hex()}", flush=True)
        except Exception as e:
            print(f"CCCD handling failed: {type(e).__name__}: {e}", flush=True)
        print("subscribed; listening 12s…", flush=True)
        for i in range(12):
            await asyncio.sleep(1)
            print(f"  t={i + 1}s connected={client.is_connected}", flush=True)


async def cmd_diag(addr):
    async with BleakClient(addr, timeout=20.0) as client:
        print(f"connected={client.is_connected}", flush=True)
        for svc in client.services:
            print(f"service {svc.uuid} ({svc.description})", flush=True)
            for ch in svc.characteristics:
                print(f"  char {ch.uuid} handle={ch.handle} props={ch.properties}", flush=True)
                for d in ch.descriptors:
                    print(f"      desc {d.uuid} handle={d.handle}", flush=True)


async def cmd_probe(addr):
    async def fn(t):
        t.log("probe: collecting datapoints for 6s (flip the scooter's switch to see dp 15 move)…")
        await asyncio.sleep(6)
        t.log("last datapoints: " + str(dict(sorted(t.last_dps.items()))))
    await with_client(addr, fn)


async def cmd_send(addr, dp_id, dt, value, code=None, header=False):
    async def fn(t):
        await t.send(int(code or "0x0027", 16), _variant_payload(int(dp_id), dt, value, header),
                     wait=True, timeout=6)
        await asyncio.sleep(1.5)
        t.log(f"read-back dp {dp_id} = {t.last_dps.get(int(dp_id), '<none>')}")
    await with_client(addr, fn)


def _variant_payload(dp_id, dt, value, header):
    """Build a v4 FUN_SENDER_DPS_V4 payload.

    Correct v4 form = 5-byte header `version(1)=0 | sn(4) uint32 BE` followed by
    the 2-byte-length KLV list.  Bare KLV (no header) is accepted at the session
    layer but silently ignored by the firmware, which parses version=dp_id and
    rejects the write ("cmd dp write version not support").
    """
    klv = encode_klv([(dp_id, dt, value)], 2)
    if not header:
        return klv  # deliberately-sent-broken variant, for comparison
    return struct.pack(">BI", 0x00, 1) + klv


async def cmd_variants(addr):
    # gear dp 15 is a good probe: physical switch moves it 1<->2, so a working
    # write will show up in the periodic reports.
    GEAR, DT_ENUM = 15, 4

    async def fn(t):
        t.log("collecting a few reports first…")
        await asyncio.sleep(4)
        before = dict(t.last_dps)
        t.log(f"baseline: dp15={before.get(15)!r} dp1={before.get(1)!r}")
        trials = [
            ("code 0x0027 + v4 header (version|sn) — CORRECT", 0x0027, True),
            ("code 0x0027 bare KLV (no header) — the old broken way", 0x0027, False),
            ("code 0x0002 (v3 DPS) 2-byte len", 0x0002, False),
        ]
        for label, code, hdr in trials:
            t.log(f"--- trying {label} ---")
            try:
                await t.send(code, _variant_payload(GEAR, DT_ENUM, 2, hdr), wait=True, timeout=6)
            except Exception as e:
                t.log(f"    send failed: {e}")
            await asyncio.sleep(2.5)
            t.log(f"    dp15 now = {t.last_dps.get(15)!r}  (baseline {before.get(15)!r})")
    await with_client(addr, fn)


def main():
    if "--resp" in sys.argv:
        os.environ["TUYA_WRITE_RESP"] = "1"
    if "--pair" in sys.argv:
        os.environ["TUYA_PAIR"] = "1"
    if "--mtu" in sys.argv:
        os.environ["TUYA_MTU"] = sys.argv[sys.argv.index("--mtu") + 1]
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    cmd, addr = sys.argv[1], sys.argv[2]
    if cmd == "probe":
        asyncio.run(cmd_probe(addr))
    elif cmd == "diag":
        asyncio.run(cmd_diag(addr))
    elif cmd == "listen":
        asyncio.run(cmd_listen(addr))
    elif cmd == "variants":
        asyncio.run(cmd_variants(addr))
    elif cmd == "send":
        dp_id, dt, value = int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
        code = None
        header = "--hdr" in sys.argv
        if "--code" in sys.argv:
            code = sys.argv[sys.argv.index("--code") + 1]
        asyncio.run(cmd_send(addr, dp_id, dt, value, code, header))
    else:
        raise SystemExit(f"unknown command {cmd}\n{__doc__}")


if __name__ == "__main__":
    main()
