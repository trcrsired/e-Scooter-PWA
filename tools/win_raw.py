#!/usr/bin/env python3
"""Raw WinRT BLE probe: bypass bleak and subscribe to the Tuya notify char
directly, then send the device-info request and print everything the scooter
sends back.  This isolates "can this PC receive notifications at all?" from any
bleak behaviour.

    python win_raw.py [--addr DC235155D8BC]
"""
import asyncio
import hashlib
import os
import struct
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pure_aes  # noqa: E402

from winrt.windows.devices.bluetooth import BluetoothLEDevice, BluetoothCacheMode
from winrt.windows.devices.bluetooth.genericattributeprofile import (
    GattClientCharacteristicConfigurationDescriptorValue,
)
from winrt.windows.foundation import Guid
from winrt.windows.storage.streams import DataReader, DataWriter


def crc16(buf):
    crc = 0xFFFF
    for b in buf:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc & 0xFFFF


def device_info_packet():
    key_login = hashlib.md5(b"").digest()  # local_key is empty
    data = bytes([0x00, 0xF3])
    raw = struct.pack(">IIHH", 1, 0, 0x0000, len(data)) + data
    raw += struct.pack(">H", crc16(raw))
    iv = os.urandom(16)
    ct = pure_aes.cbc_encrypt(key_login, iv, raw)
    payload = bytes([0x04]) + iv + ct
    return bytes([0x00, len(payload), 0x40]) + payload

ADDR = int("DC235155D8BC", 16)
SERVICE_UUID = uuid.UUID("0000fd50-0000-1000-8000-00805f9b34fb")
WRITE_UUID = uuid.UUID("00000001-0000-1001-8001-00805f9b07d0")
NOTIFY_UUID = uuid.UUID("00000002-0000-1001-8001-00805f9b07d0")


def ibuffer_to_bytes(buf):
    reader = DataReader.from_buffer(buf)
    return bytes(bytearray(reader.read_bytes(reader.unconsumed_buffer_length)))


def bytes_to_ibuffer(data):
    writer = DataWriter()
    writer.write_bytes(bytes(data))
    return writer.detach_buffer()


async def main():
    print(f"connecting to {ADDR:012X}…", flush=True)
    dev = await BluetoothLEDevice.from_bluetooth_address_async(ADDR)
    if dev is None:
        print("BluetoothLEDevice is None", flush=True)
        return
    print(f"device: name={dev.name!r} connection_status={dev.connection_status}", flush=True)

    def on_conn(sender, args):
        print(f"[conn] status={sender.connection_status}", flush=True)

    dev.add_connection_status_changed(on_conn)

    res = await dev.get_gatt_services_async(BluetoothCacheMode.UNCACHED)
    svc = None
    for s in res.services:
        if str(s.uuid).lower() == str(SERVICE_UUID):
            svc = s
    if svc is None:
        print("service fd50 not found", flush=True)
        return
    print(f"service found: {svc.uuid}", flush=True)

    notify_char = None
    write_char = None
    for ch in await svc.get_characteristics_async(BluetoothCacheMode.UNCACHED):
        u = str(ch.uuid).lower()
        print(f"  char {u} props={ch.characteristic_properties}", flush=True)
        if u == str(NOTIFY_UUID):
            notify_char = ch
        elif u == str(WRITE_UUID):
            write_char = ch
    if not notify_char or not write_char:
        print("chars missing", flush=True)
        return

    def on_value_changed(sender, args):
        data = ibuffer_to_bytes(args.characteristic_value)
        print("<< " + data.hex(" "), flush=True)

    notify_char.add_value_changed(on_value_changed)
    st = await notify_char.write_client_characteristic_configuration_descriptor_async(
        GattClientCharacteristicConfigurationDescriptorValue.NOTIFY)
    print(f"CCCD write status = {st}", flush=True)

    # real, correctly-encrypted device-info request
    pkt = device_info_packet()
    print(">> " + pkt.hex(" "), flush=True)
    st2 = await write_char.write_value_with_result_async(bytes_to_ibuffer(pkt))
    print(f"write status = {st2}", flush=True)

    print("listening 15s…", flush=True)
    for i in range(15):
        await asyncio.sleep(1)
        print(f"  t={i + 1}s conn={dev.connection_status}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
