#!/usr/bin/env python3
"""Decode ATT writes/notifications out of an Android btsnoop_hci.log.

Usage:
    python3 btsnoop_att.py btsnoop_hci.log [filter_hex]

The optional filter_hex is a lowercase hex substring (e.g. "0001" or "fd50")
matched against the raw ATT value; only matching lines are printed (with a
little context note). Run with no filter to see everything.

We only care about the Tuya BLE DP channel, so by default we print ATT
Write Request/Command (host -> scooter) and Handle Value
Notification/Indication (scooter -> host).
"""
import struct
import sys


def parse_btsnoop(path):
    """Yield (ts_us, direction, data) for every HCI packet in the file.

    direction is '>' (host->controller / sent) or '<' (controller->host /
    received).  data is the raw HCI packet incl. the H4 type byte (if any).
    """
    with open(path, "rb") as f:
        blob = f.read()
    if blob[:8] != b"btsnoop\x00":
        raise SystemExit("not a btsnoop file (bad magic)")
    version, datalink = struct.unpack(">II", blob[8:16])
    sys.stderr.write(f"btsnoop version={version} datalink={datalink}\n")
    pos = 16
    ts_base = 0  # microseconds since 2000-01-01; relative printing only
    while pos + 24 <= len(blob):
        orig_len, inc_len, flags, drops, ts = struct.unpack(">IIIIq", blob[pos:pos + 24])
        pos += 24
        data = blob[pos:pos + inc_len]
        pos += inc_len
        direction = ">" if (flags & 1) == 0 else "<"
        yield ts, direction, data


ATT_WRITE_CMD = 0x52
ATT_WRITE_REQ = 0x12
ATT_NOTIFY = 0x1B
ATT_INDICATE = 0x1D
ATT_READ_REQ = 0x0A
ATT_READ_RSP = 0x0B
ATT_HANDLE_VALUE_CFM = 0x1E

ATT_OPCODE_NAME = {
    ATT_WRITE_CMD: "WriteCmd",
    ATT_WRITE_REQ: "WriteReq",
    ATT_NOTIFY: "Notify",
    ATT_INDICATE: "Indicate",
    ATT_READ_REQ: "ReadReq",
    ATT_READ_RSP: "ReadRsp",
    ATT_HANDLE_VALUE_CFM: "HandleValueCfm",
}


def iter_acl(records):
    """Reassemble L2CAP PDUs from HCI ACL fragments.

    An ACL Data packet can carry a whole L2CAP PDU (PB=0b00/0b10) or one
    fragment of a longer one (PB=0b01 continuing). We therefore accumulate
    per-handle bytes and only emit once the L2CAP length field says the PDU
    is complete.
    """
    buf = {}
    for ts, direction, data in records:
        if not data:
            continue
        # Strip the H4 type byte if present (type 0x02 = ACL).
        t = data[0]
        if t == 0x02:
            hci = data[1:]
        elif t in (0x01, 0x03, 0x04, 0x05):
            continue  # not ACL
        else:
            hci = data  # no type byte (uncommon)
        if len(hci) < 4:
            continue
        handle_field = struct.unpack("<H", hci[0:2])[0]
        h = handle_field & 0x0FFF
        pb = (handle_field >> 12) & 0x3
        length = struct.unpack("<H", hci[2:4])[0]
        payload = hci[4:4 + length]
        if pb == 0x1:                 # continuation
            buf[h] = buf.get(h, bytearray()) + payload
        else:                         # 0x0 / 0x2 start, or 0x3 complete
            buf[h] = bytearray(payload)
        pdu = buf.get(h)
        if pdu is None or len(pdu) < 4:
            continue
        l2_len = struct.unpack("<H", pdu[0:2])[0]
        if len(pdu) < 4 + l2_len:
            continue                  # wait for more fragments
        del buf[h]
        cid = struct.unpack("<H", pdu[2:4])[0]
        if cid != 0x04:               # ATT only
            continue
        yield ts, direction, h, bytes(pdu[4:4 + l2_len])


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    flt = sys.argv[2].replace(" ", "").lower() if len(sys.argv) > 2 else None
    n = 0
    for ts, direction, handle, att in iter_acl(parse_btsnoop(sys.argv[1])):
        if len(att) < 1:
            continue
        op = att[0]
        if op in (ATT_WRITE_CMD, ATT_WRITE_REQ, ATT_NOTIFY, ATT_INDICATE):
            if len(att) < 3:
                continue
            vh = struct.unpack("<H", att[1:3])[0]
            value = att[3:]
            hexv = value.hex()
            if flt and flt not in hexv:
                continue
            name = ATT_OPCODE_NAME.get(op, hex(op))
            print(f"{direction} h=0x{vh:04x} {name:9s} {len(value):3d}  {hexv}")
            n += 1
    sys.stderr.write(f"matched {n} ATT value packet(s)\n")


if __name__ == "__main__":
    main()
