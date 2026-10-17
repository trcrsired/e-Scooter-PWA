/*
 * tuya_ble.js — Tuya BLE (application/central side) protocol for the browser.
 *
 * This is the part the PWA was missing: without it the GATT link connects
 * (the scooter beeps) but no command is ever spoken, so nothing happens.
 *
 * Ported from the `tuya_ble` / ha_tuya_ble reference implementation
 * (PlusPlus-ua, MIT), which itself derives from redphx/poc-tuya-ble-fingerbot.
 *
 * Layers, bottom to top:
 *   GATT:      write 0x2b11, notify 0x2b10 (service 0xa201 / 0x1910)
 *   transport: 20-byte chunks, varint sub-packet number; first chunk also
 *              carries varint total length + (protocol_version << 4)
 *   security:  flag(1) | iv(16) | AES-128-CBC(frame)
 *   frame:     seq(4) | response_to(4) | code(2) | len(2) | data | crc16(2)
 *   payload:   code-specific (device info, pair, datapoint KLV)
 *
 * No dependencies beyond a Crypto object providing md5 / cbcEncrypt /
 * cbcDecrypt (the wasm module), injected by the caller.
 */
(function (global) {
  "use strict";

  const SERVICE_UUIDS = [
    "0000a201-0000-1000-8000-00805f9b34fb",
    "00001910-0000-1000-8000-00805f9b34fb",
  ];
  const WRITE_UUID = "00002b11-0000-1000-8000-00805f9b34fb";
  const NOTIFY_UUID = "00002b10-0000-1000-8000-00805f9b34fb";
  const GATT_MTU = 20;

  const CODE = {
    DEVICE_INFO: 0x0000,
    PAIR: 0x0001,
    DPS: 0x0002,
    DEVICE_STATUS: 0x0003,
    UNBIND: 0x0005,
    DEVICE_RESET: 0x0006,
    DPS_V4: 0x0027,
    RECV_DP: 0x8001,
    RECV_TIME_DP: 0x8003,
    RECV_SIGN_DP: 0x8004,
    RECV_SIGN_TIME_DP: 0x8005,
    RECV_DP_V4: 0x8006,
    RECV_TIME_DP_V4: 0x8007,
    RECV_TIME1_REQ: 0x8011,
    RECV_TIME2_REQ: 0x8012,
  };

  const DT = { RAW: 0, BOOL: 1, VALUE: 2, STRING: 3, ENUM: 4, BITMAP: 5 };

  const SEC_NONE = 0, SEC_AUTH = 1, SEC_LOGIN = 4, SEC_SESSION = 5;

  // ------------------------------------------------------------------ utils
  function crc16(bytes) {
    let crc = 0xffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i] & 0xff;
      for (let b = 0; b < 8; b++) {
        const tmp = crc & 1;
        crc >>= 1;
        if (tmp) crc ^= 0xa001;
      }
    }
    return crc & 0xffff;
  }

  function randomBytes(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  function asciiBytes(str) {
    const s = String(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }

  function concat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  function packVarint(value) {
    const out = [];
    let v = value >>> 0;
    do {
      let b = v & 0x7f;
      v >>>= 7;
      if (v !== 0) b |= 0x80;
      out.push(b);
    } while (v !== 0);
    return Uint8Array.from(out);
  }

  function unpackVarint(bytes, pos) {
    let result = 0, shift = 0;
    while (shift < 35) {
      if (pos >= bytes.length) throw new Error("varint overrun");
      const b = bytes[pos++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return [result >>> 0, pos];
      shift += 7;
    }
    throw new Error("varint too long");
  }

  function hex(bytes) {
    return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join(" ");
  }

  // --------------------------------------------------------- datapoint codec
  function encodeDpValue(type, value) {
    switch (type) {
      case DT.BOOL:
        return Uint8Array.of(value ? 1 : 0);
      case DT.VALUE: {
        const b = new Uint8Array(4);
        new DataView(b.buffer).setInt32(0, value | 0, false);
        return b;
      }
      case DT.ENUM: {
        const v = value | 0;
        if (v > 0xffff) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, false); return b; }
        if (v > 0xff) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, false); return b; }
        return Uint8Array.of(v & 0xff);
      }
      case DT.BITMAP: {
        const v = value | 0;
        if (v > 0xffff) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, false); return b; }
        if (v > 0xff) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, false); return b; }
        return Uint8Array.of(v & 0xff);
      }
      case DT.STRING:
        return new TextEncoder().encode(String(value));
      default:
        return value instanceof Uint8Array ? value : Uint8Array.from(value || []);
    }
  }

  function decodeDpValue(type, raw) {
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    switch (type) {
      case DT.BOOL: return raw.length > 0 ? raw[0] !== 0 : false;
      case DT.VALUE: return raw.length >= 4 ? dv.getInt32(0, false) : 0;
      case DT.ENUM:
      case DT.BITMAP: {
        let v = 0;
        for (let i = 0; i < raw.length && i < 4; i++) v = (v << 8) | raw[i];
        return v;
      }
      case DT.STRING: return new TextDecoder().decode(raw);
      default: return raw.slice();
    }
  }

  /* KLV block. lenSize = 1 (v3) or 2 (v4) bytes for the per-datapoint length. */
  function encodeKlv(dps, lenSize) {
    const parts = [];
    for (const dp of dps) {
      const value = encodeDpValue(dp.type, dp.value);
      const hdr = new Uint8Array(2 + lenSize);
      hdr[0] = dp.id & 0xff;
      hdr[1] = dp.type & 0xff;
      if (lenSize === 2) { hdr[2] = (value.length >> 8) & 0xff; hdr[3] = value.length & 0xff; }
      else hdr[2] = value.length & 0xff;
      parts.push(hdr, value);
    }
    return concat(parts);
  }

  function parseKlv(data, lenSize, offset) {
    const dps = [];
    let p = offset;
    const overhead = 2 + lenSize;
    while (data.length - p >= overhead) {
      const id = data[p++];
      const type = data[p++];
      let len;
      if (lenSize === 2) { len = (data[p] << 8) | data[p + 1]; p += 2; }
      else len = data[p++];
      if (p + len > data.length) break;
      const raw = data.subarray(p, p + len);
      p += len;
      dps.push({ id, type, value: decodeDpValue(type, raw) });
    }
    return dps;
  }

  // ------------------------------------------------------------------- class
  function TuyaBLE(crypto, handlers) {
    this.crypto = crypto || {};
    this.onLog = (handlers && handlers.onLog) || function () {};
    this.onDp = (handlers && handlers.onDp) || function () {};
    this.onReady = (handlers && handlers.onReady) || function () {};

    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.creds = null;

    this.seq = 1;
    this.protocolVersion = 2;
    this.keyLogin = null;    // md5(login_key)          -> security flag 4
    this.keySession = null;  // md5(login_key + srand)  -> security flag 5
    this.keyAuth = null;     // device auth_key         -> security flag 1
    this.paired = false;
    // Datapoint writes are the ONLY BLE messages that can change the
    // scooter's behaviour. Until they are explicitly turned on, they are
    // refused at the source rather than silently transmitted.
    this.allowWrites = false;
    this.pending = new Map();
    this._opLock = Promise.resolve();

    // reassembly state
    this.rxBuffer = null;
    this.rxExpectedLen = 0;
    this.rxExpectedNum = 0;

    this._onNotify = this._onNotify.bind(this);
  }

  TuyaBLE.SERVICE_UUIDS = SERVICE_UUIDS;
  TuyaBLE.WRITE_UUID = WRITE_UUID;
  TuyaBLE.NOTIFY_UUID = NOTIFY_UUID;
  TuyaBLE.CODE = CODE;
  TuyaBLE.DT = DT;
  TuyaBLE.hex = hex;
  TuyaBLE.parseKlv = parseKlv;

  TuyaBLE.prototype.log = function (msg) { this.onLog(msg); };

  /* ---- GATT ---- */
  TuyaBLE.prototype.discover = async function () {
    const sh = u => {
      u = String(u).toLowerCase();
      const m = u.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
      return m ? "0x" + m[1] : u;
    };

    let services = [];
    try { services = await this.server.getPrimaryServices(); }
    catch (e) { this.log("getPrimaryServices failed: " + e.message); }
    this.log("services seen (" + services.length + "): " +
      (services.map(s => sh(s.uuid)).join(", ") || "(none)"));

    let writeChar = null, notifyChar = null;
    const pairs = [];
    for (const service of services) {
      let chars = [];
      try { chars = await service.getCharacteristics(); }
      catch (e) { this.log("  (" + sh(service.uuid) + "): " + e.message); continue; }
      const sw = [], sn = [];
      for (const c of chars) {
        const u = c.uuid.toLowerCase();
        this.log("  char " + sh(u) + " [" +
          Object.keys(c.properties).filter(k => c.properties[k]).join(",") + "]");
        if (u === WRITE_UUID) writeChar = c;
        else if (u === NOTIFY_UUID) notifyChar = c;
        if (c.properties.write || c.properties.writeWithoutResponse) sw.push(c);
        if (c.properties.notify || c.properties.indicate) sn.push(c);
      }
      if (sw.length || sn.length) pairs.push({ uuid: service.uuid, sw, sn });
    }

    if (!writeChar || !notifyChar) {
      // Prefer a service whose UUID looks like Tuya (a201/1910); otherwise,
      // if exactly one service exposes both a writable and a notifiable
      // characteristic, use that pair.
      const tuya = pairs.find(p => /a201|1910/.test(String(p.uuid).toLowerCase()));
      const both = pairs.filter(p => p.sw.length && p.sn.length);
      const pick = tuya || (both.length === 1 ? both[0] : null);
      if (pick) {
        if (!writeChar) writeChar = pick.sw[0];
        if (!notifyChar) notifyChar = pick.sn[0];
        this.log("fallback: using service " + sh(pick.uuid));
      } else if (both.length > 1) {
        this.log("ambiguous: " + both.length +
          " services expose write+notify and none matched a Tuya UUID");
      }
    }
    return { writeChar, notifyChar, services };
  };

  TuyaBLE.prototype.connect = async function (device, creds) {
    this.device = device;
    this.creds = creds;
    this.log("connecting to GATT…");
    this.server = await device.gatt.connect();

    const { writeChar, notifyChar } = await this.discover();
    if (!writeChar || !notifyChar) {
      throw new Error("Tuya BLE characteristics not found (write=" +
        (writeChar ? writeChar.uuid : "none") + ", notify=" +
        (notifyChar ? notifyChar.uuid : "none") + ") — open Diagnostics and copy the log");
    }
    this.writeChar = writeChar;
    this.notifyChar = notifyChar;
    this.log("write=" + writeChar.uuid + "  notify=" + notifyChar.uuid);

    await notifyChar.startNotifications();
    notifyChar.addEventListener("characteristicvaluechanged", this._onNotify);
    this.log("notifications started");

    this.keyLogin = this.crypto.md5(asciiBytes(String(creds.localKey).slice(0, 6)));
    await this._handshake();
    this.onReady();
  };

  TuyaBLE.prototype.disconnect = function () {
    try { this.notifyChar && this.notifyChar.removeEventListener("characteristicvaluechanged", this._onNotify); } catch (_) {}
    try { this.device && this.device.gatt.connected && this.device.gatt.disconnect(); } catch (_) {}
  };

  /* ---- handshake ---- */
  TuyaBLE.prototype._handshake = async function () {
    this.log("→ device info request");
    const info = await this.send(CODE.DEVICE_INFO, new Uint8Array(0), { timeout: 8000 });
    if (!this.keySession) throw new Error("handshake failed: session key not derived");
    this.log("device info ok (bound=" + this.isBound + ", protocol=" + this.protocolVersion + ")");

    const pairPayload = this._buildPairPayload();
    this.log("→ pair request");
    const res = await this.send(CODE.PAIR, pairPayload, { timeout: 8000 });
    const code = res && res.data && res.data.length ? res.data[0] : 0;
    if (code === 1) throw new Error("pair rejected by device");
    this.paired = true;
    this.log("paired" + (code === 2 ? " (already bound)" : ""));

    // Ask the device to dump its current datapoints.
    this.send(CODE.DEVICE_STATUS, new Uint8Array(0), { wait: false }).catch(() => {});
  };

  TuyaBLE.prototype._buildPairPayload = function () {
    const uuid = asciiBytes(this.creds.uuid);
    const login = asciiBytes(String(this.creds.localKey).slice(0, 6));
    const dev = asciiBytes(this.creds.deviceId);
    const total = 44;
    const out = new Uint8Array(total);
    let o = 0;
    for (const part of [uuid, login, dev]) {
      if (o >= total) break;
      const n = Math.min(part.length, total - o);
      out.set(part.subarray(0, n), o);
      o += n;
    }
    return out;
  };

  /* ---- outgoing packets ---- */
  TuyaBLE.prototype._keyFor = function (code) {
    if (code === CODE.DEVICE_INFO) return { key: this.keyLogin, flag: SEC_LOGIN };
    return { key: this.keySession, flag: SEC_SESSION };
  };

  TuyaBLE.prototype._buildPackets = function (seq, code, data, responseTo) {
    const { key, flag } = this._keyFor(code);
    if (!key) throw new Error("no key for code 0x" + code.toString(16));

    const raw = new Uint8Array(12 + data.length + 2);
    const dv = new DataView(raw.buffer);
    dv.setUint32(0, seq >>> 0, false);
    dv.setUint32(4, responseTo >>> 0, false);
    dv.setUint16(8, code & 0xffff, false);
    dv.setUint16(10, data.length, false);
    raw.set(data, 12);
    dv.setUint16(12 + data.length, crc16(raw.subarray(0, 12 + data.length)), false);

    const pad = (16 - (raw.length % 16)) % 16;
    const plain = pad ? concat([raw, new Uint8Array(pad)]) : raw;

    const iv = randomBytes(16);
    const enc = this.crypto.cbcEncrypt(key, iv, plain);
    const payload = concat([Uint8Array.of(flag), iv, enc]);

    const packets = [];
    let pos = 0, num = 0;
    while (pos < payload.length) {
      let hdr = packVarint(num);
      if (num === 0) {
        hdr = concat([hdr, packVarint(payload.length), Uint8Array.of((this.protocolVersion << 4) & 0xff)]);
      }
      const chunk = payload.subarray(pos, pos + Math.max(1, GATT_MTU - hdr.length));
      packets.push(concat([hdr, chunk]));
      pos += chunk.length;
      num++;
    }
    return packets;
  };

  TuyaBLE.prototype._write = async function (packet) {
    if (this.writeChar.properties.writeWithoutResponse && this.writeChar.writeValueWithoutResponse) {
      await this.writeChar.writeValueWithoutResponse(packet);
    } else {
      await this.writeChar.writeValue(packet);
    }
  };

  TuyaBLE.prototype.send = async function (code, data, opts) {
    opts = opts || {};
    const seq = this.seq++;
    const responseTo = opts.responseTo || 0;
    const packets = this._buildPackets(seq, code, data, responseTo);
    const wait = opts.wait !== false;

    let promise = null;
    if (wait) {
      promise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(seq);
          reject(new Error("timeout waiting for response to 0x" + code.toString(16) +
            (code === CODE.DEVICE_INFO
              ? " — device did not answer the handshake (it may use the newer Tuya secure protocol / different local_key)"
              : "")));
        }, opts.timeout || 15000);
        this.pending.set(seq, { resolve, reject, timer, code });
      });
    }

    await this._withLock(async () => {
      for (const p of packets) await this._write(p);
    });

    return promise;
  };

  /* Serialize the writes of one logical message so two concurrent send()
   * calls cannot interleave sub-packets on the wire (which would corrupt the
   * device's reassembly buffer). */
  TuyaBLE.prototype._withLock = function (fn) {
    const run = this._opLock.then(fn, fn);
    this._opLock = run.catch(() => {});
    return run;
  };

  /* ---- inbound ---- */
  TuyaBLE.prototype._onNotify = function (event) {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    this.log("rx raw [" + bytes.length + "]: " + hex(bytes));
    try { this._reassemble(bytes); }
    catch (e) { this.log("rx error: " + e.message); }
  };

  TuyaBLE.prototype._resetRx = function () {
    this.rxBuffer = null;
    this.rxExpectedLen = 0;
    this.rxExpectedNum = 0;
  };

  TuyaBLE.prototype._reassemble = function (bytes) {
    let pos = 0;
    let num;
    [num, pos] = unpackVarint(bytes, pos);

    if (num < this.rxExpectedNum) {
      this.log("rx: stale sub-packet " + num);
      this._resetRx();
    }

    if (num === 0) {
      this.rxBuffer = [];
      [this.rxExpectedLen, pos] = unpackVarint(bytes, pos);
      if (pos >= bytes.length) { this._resetRx(); return; }
      pos += 1; // transport version byte (protocol_version << 4)
      this.rxExpectedNum = 0;
    }

    if (num !== this.rxExpectedNum) {
      this.log("rx: missing sub-packet, expected " + this.rxExpectedNum + " got " + num);
      this._resetRx();
      return;
    }

    this.rxBuffer.push(bytes.subarray(pos));
    this.rxExpectedNum++;

    let len = 0;
    for (const c of this.rxBuffer) len += c.length;
    if (len > this.rxExpectedLen) { this.log("rx: overflow"); this._resetRx(); return; }
    if (len === this.rxExpectedLen) {
      const full = concat(this.rxBuffer);
      this._resetRx();
      this._parseInput(full);
    }
  };

  TuyaBLE.prototype._keyOfFlag = function (flag) {
    if (flag === SEC_AUTH) return this.keyAuth;
    if (flag === SEC_LOGIN) return this.keyLogin;
    if (flag === SEC_SESSION) return this.keySession;
    return null;
  };

  TuyaBLE.prototype._parseInput = function (buf) {
    const flag = buf[0];
    const key = this._keyOfFlag(flag);
    if (!key) { this.log("rx: unknown security flag " + flag); return; }
    const iv = buf.subarray(1, 17);
    const ct = buf.subarray(17);
    const raw = this.crypto.cbcDecrypt(key, iv, ct);

    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const seq = dv.getUint32(0, false);
    const responseTo = dv.getUint32(4, false);
    const code = dv.getUint16(8, false);
    const length = dv.getUint16(10, false);
    if (12 + length + 2 > raw.length) { this.log("rx: short frame"); return; }
    const expect = crc16(raw.subarray(0, 12 + length));
    const got = dv.getUint16(12 + length, false);
    if (expect !== got) { this.log("rx: CRC mismatch"); return; }
    const data = raw.subarray(12, 12 + length);

    this._handle(seq, responseTo, code, data);
  };

  TuyaBLE.prototype._handle = function (seq, responseTo, code, data) {
    switch (code) {
      case CODE.DEVICE_INFO:
        this.log("device info data: " + hex(data));
        if (data.length >= 14) {
          this.protocolVersion = data[2] || 2;
          this.flags = data[4];
          this.isBound = data[5] !== 0;
          const srand = data.subarray(6, 12);
          this.keySession = this.crypto.md5(concat([
            asciiBytes(String(this.creds.localKey).slice(0, 6)), srand,
          ]));
          if (data.length >= 46) this.keyAuth = data.subarray(14, 46);
        } else {
          this.log("rx: device info too short (" + data.length + ")"); 
        }
        break;

      case CODE.PAIR:
        break;

      case CODE.RECV_DP:
        // v3 report: [id,type,len(1),value]...
        for (const dp of parseKlv(data, 1, 0)) this.onDp(dp);
        this._ack(seq, code, new Uint8Array(0));
        break;

      case CODE.RECV_TIME_DP:
        for (const dp of parseKlv(data, 1, 5)) this.onDp(dp);
        this._ack(seq, code, new Uint8Array(0));
        break;

      case CODE.RECV_SIGN_DP:
        for (const dp of parseKlv(data, 1, 3)) this.onDp(dp);
        this._ack(seq, code, data.subarray(0, 3));
        break;

      case CODE.RECV_SIGN_TIME_DP:
        for (const dp of parseKlv(data, 1, 8)) this.onDp(dp);
        this._ack(seq, code, data.subarray(0, 3));
        break;

      case CODE.RECV_DP_V4:
        // v4 report: version(1) | sn(4) | type(1) | flag(1) | KLV(len 2B)
        for (const dp of parseKlv(data, 2, 7)) this.onDp(dp);
        this._ack(seq, code, new Uint8Array(0));
        break;

      case CODE.RECV_TIME_DP_V4:
        // as above + time type(1) | timestamp(4)
        for (const dp of parseKlv(data, 2, 12)) this.onDp(dp);
        this._ack(seq, code, new Uint8Array(0));
        break;

      case CODE.RECV_TIME1_REQ:
        this._sendTime1(seq);
        break;

      case CODE.RECV_TIME2_REQ:
        this._sendTime2(seq);
        break;

      default:
        this.log("rx code 0x" + code.toString(16) + " data=" + hex(data));
    }

    if (responseTo) {
      const p = this.pending.get(responseTo);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(responseTo);
        p.resolve({ seq, code, data });
      }
    }
  };

  TuyaBLE.prototype._ack = function (seq, code, data) {
    this.send(code, data, { responseTo: seq, wait: false }).catch(() => {});
  };

  TuyaBLE.prototype._sendTime1 = function (seq) {
    const ms = Date.now();
    const payload = concat([
      new TextEncoder().encode(String(ms)),
      new Uint8Array(2), // timezone, best-effort 0
    ]);
    this._ack(seq, CODE.RECV_TIME1_REQ, payload);
  };

  TuyaBLE.prototype._sendTime2 = function (seq) {
    const d = new Date();
    const payload = new Uint8Array(8);
    payload[0] = d.getFullYear() % 100;
    payload[1] = d.getMonth() + 1;
    payload[2] = d.getDate();
    payload[3] = d.getHours();
    payload[4] = d.getMinutes();
    payload[5] = d.getSeconds();
    payload[6] = d.getDay();
    payload[7] = 0;
    this._ack(seq, CODE.RECV_TIME2_REQ, payload);
  };

  /* ---- datapoints ---- */
  TuyaBLE.prototype.sendDps = function (dps) {
    // dps: [{ id, type, value }]
    if (!this.allowWrites) {
      this.log("blocked DP write (observe-only): " +
        dps.map(function (d) { return "dp " + d.id + " = " + d.value; }).join(", "));
      return Promise.resolve();
    }
    const raw = encodeKlv(dps, 1);
    return this.send(CODE.DPS, raw, { wait: false }).catch(() => {});
  };

  TuyaBLE.prototype.sendDp = function (id, type, value) {
    return this.sendDps([{ id, type, value }]);
  };

  global.TuyaBLE = TuyaBLE;
  global.TuyaDT = DT;
})(window);
