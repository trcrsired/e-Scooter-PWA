// -------------------------
// 1. Localization dictionary
// -------------------------
const i18n = {
  en: {
    title: "Web Bluetooth PWA",
    connect: "Connect to Bluetooth Device",
    status_idle: "Status: Not connected",
    status_scanning: "Status: Scanning…",
    status_selected: name => `Status: Selected device ${name}`,
    status_connected: name => `Status: Connected to ${name}`,
    status_disconnected: "Status: Disconnected",
    battery: level => `Battery: ${level}%`,
    no_battery: "Device does not support battery service",
    failed: err => `Connection failed: ${err}`,
    settings: "Settings",
    key_label: "Local key (AES-128)",
    devid_label: "Device ID",
    save: "Save",
    saved: "Saved",
    key_bad: "Key must be 16 chars or 32 hex digits",
    wasm_ok: "crypto module loaded",
    wasm_missing: "tuya_crypto.wasm not found — run the build in cpp/"
  },

  zh: {
    title: "Web 蓝牙 PWA",
    connect: "连接蓝牙设备",
    status_idle: "状态：未连接",
    status_scanning: "状态：扫描中…",
    status_selected: name => `状态：已选择设备 ${name}`,
    status_connected: name => `状态：已连接到 ${name}`,
    status_disconnected: "状态：已断开",
    battery: level => `电量：${level}%`,
    no_battery: "设备不支持电量服务",
    failed: err => `连接失败：${err}`,
    settings: "设置",
    key_label: "本地密钥 (AES-128)",
    devid_label: "设备 ID",
    save: "保存",
    saved: "已保存",
    key_bad: "密钥须为 16 个字符或 32 位十六进制",
    wasm_ok: "加密模块已加载",
    wasm_missing: "未找到 tuya_crypto.wasm —— 请在 cpp/ 中构建"
  }
};

// -------------------------
// 2. Detect language
// -------------------------
function getLang() {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

const lang = getLang();
const t = i18n[lang];

// -------------------------
// 3. Apply localization
// -------------------------
document.getElementById("title").textContent = t.title;
document.getElementById("connectBtn").textContent = t.connect;
document.getElementById("status").textContent = t.status_idle;
document.getElementById("settingsTitle").textContent = t.settings;
document.getElementById("keyLabel").textContent = t.key_label;
document.getElementById("devIdLabel").textContent = t.devid_label;
document.getElementById("saveKeysBtn").textContent = t.save;

// -------------------------
// 4. Helpers
// -------------------------
const logEl = document.getElementById("log");

function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function hex(view) {
  const b = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join(" ");
}

function ascii(view) {
  const b = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  return [...b].map(x => (x >= 0x20 && x < 0x7f) ? String.fromCharCode(x) : ".").join("");
}

// Candidate services to probe. Web Bluetooth only grants access to
// services declared in requestDevice(), so list everything plausible.
// 0x1910 = Tuya BLE serial service (write 0x2b10, notify 0x2b11).
const CANDIDATE_SERVICES = [
  // standard SIG services
  0x1800, 0x1801, 0x1802, 0x1804, 0x1805, 0x1808, 0x1809,
  0x180a, 0x180f, 0x1812, 0x1816, 0x181a, 0x181c, 0x1822,
  "battery_service",
  "device_information",
  // Tuya BLE
  0x1910, 0xfd50, 0xfd51,
  // common vendor / serial / DFU services
  0xfff0, 0xffe0, 0xffe5, 0xffe9, 0xffe1,
  0xfe95, 0xfe59, 0xfee7, 0xfeed,
  0x0001, 0xae00,
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC transparent serial
  "0000f000-0000-1000-8000-00805f9b34fb",
  "00010203-0405-0607-0809-0a0b0c0d1912", // Telink OTA
  "00010203-0405-0607-0809-0a0b0c0d2b11"
];

// -------------------------
// 5. WASM crypto module (tuya_crypto.wasm, fast_io AES/MD5)
// -------------------------
const Crypto = {
  ex: null,

  async load() {
    const stubs = {
      proc_exit: c => { throw new Error("wasm exit " + c); },
      args_get: () => 0,
      args_sizes_get: (a, b) => { const v = new DataView(Crypto.ex.memory.buffer); v.setUint32(a, 0, true); v.setUint32(b, 0, true); return 0; },
      environ_get: () => 0,
      environ_sizes_get: (a, b) => { const v = new DataView(Crypto.ex.memory.buffer); v.setUint32(a, 0, true); v.setUint32(b, 0, true); return 0; },
      fd_write: () => 0, fd_close: () => 0, fd_seek: () => 0, fd_read: () => 0,
      clock_time_get: (id, pr, p) => { new DataView(Crypto.ex.memory.buffer).setBigUint64(p, 0n, true); return 0; },
      random_get: (p, n) => { crypto.getRandomValues(new Uint8Array(Crypto.ex.memory.buffer, p, n)); return 0; }
    };
    try {
      const resp = await fetch("tuya_crypto.wasm");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer(),
        { wasi_snapshot_preview1: stubs });
      Crypto.ex = instance.exports;
      Crypto.ex.__wasm_call_ctors();
      log(t.wasm_ok);
    } catch (e) {
      log(t.wasm_missing + " (" + e.message + ")");
    }
  },

  mem() { return new Uint8Array(this.ex.memory.buffer); },

  /* key: 16 bytes */
  setKey(k) {
    this.mem().set(k, this.ex.get_key_ptr());
    this.ex.aes128_set_key();
  },

  /* input must be a multiple of 16 bytes; returns Uint8Array (view) */
  encrypt(u8) {
    this.mem().set(u8, this.ex.get_in_ptr());
    this.ex.aes128_encrypt(u8.length / 16);
    return this.mem().slice(this.ex.get_out_ptr(), this.ex.get_out_ptr() + u8.length);
  },

  decrypt(u8) {
    this.mem().set(u8, this.ex.get_in_ptr());
    this.ex.aes128_decrypt(u8.length / 16);
    return this.mem().slice(this.ex.get_out_ptr(), this.ex.get_out_ptr() + u8.length);
  },

  /* returns 16-byte digest view */
  md5(u8) {
    this.mem().set(u8, this.ex.get_in_ptr());
    this.ex.md5_digest(u8.length);
    return this.mem().slice(this.ex.get_md5_ptr(), this.ex.get_md5_ptr() + 16);
  }
};

// -------------------------
// 6. Settings: device key storage
// -------------------------
const LS_KEY = "escooter.local_key";
const LS_DEVID = "escooter.device_id";
const keyInput = document.getElementById("keyInput");
const devIdInput = document.getElementById("devIdInput");
const keysStatus = document.getElementById("keysStatus");

function parseKey(s) {
  s = s.trim();
  if (/^[0-9a-fA-F]{32}$/.test(s)) {
    const b = new Uint8Array(16);
    for (let i = 0; i < 16; i++) b[i] = parseInt(s.substr(i * 2, 2), 16);
    return b;
  }
  if (s.length === 16) return new TextEncoder().encode(s);
  return null;
}

function applyStoredKey() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw || !Crypto.ex) return;
  const k = parseKey(raw);
  if (k) Crypto.setKey(k);
}

keyInput.value = localStorage.getItem(LS_KEY) || "";
devIdInput.value = localStorage.getItem(LS_DEVID) || "";

document.getElementById("saveKeysBtn").onclick = () => {
  const k = parseKey(keyInput.value);
  if (!k) { keysStatus.textContent = t.key_bad; return; }
  localStorage.setItem(LS_KEY, keyInput.value.trim());
  localStorage.setItem(LS_DEVID, devIdInput.value.trim());
  if (Crypto.ex) Crypto.setKey(k);
  keysStatus.textContent = t.saved;
};

Crypto.load().then(applyStoredKey);

// -------------------------
// 7. BLE logic
// -------------------------
const connectBtn = document.getElementById("connectBtn");
const statusEl = document.getElementById("status");
const batteryEl = document.getElementById("battery");

async function enumerateGatt(server) {
  const services = await server.getPrimaryServices();
  log(`GATT: ${services.length} primary service(s)`);
  for (const service of services) {
    log(`service ${service.uuid}`);
    let chars;
    try {
      chars = await service.getCharacteristics();
    } catch (e) {
      log(`  (cannot list characteristics: ${e.message})`);
      continue;
    }
    for (const c of chars) {
      const props = Object.entries(c.properties)
        .filter(([, v]) => v).map(([k]) => k).join(",");
      log(`  char ${c.uuid} [${props}]`);
      try {
        for (const d of await c.getDescriptors()) {
          log(`    desc ${d.uuid}`);
        }
      } catch (_) { /* no descriptors */ }
      if (c.properties.read) {
        try {
          const v = await c.readValue();
          log(`    read: ${hex(v)}  |${ascii(v)}|`);
        } catch (e) {
          log(`    read failed: ${e.message}`);
        }
      }
    }
  }
}

async function watchAdvertisements(device) {
  if (!device.watchAdvertisements) {
    log("watchAdvertisements not supported in this browser");
    return;
  }
  device.addEventListener("advertisementreceived", ev => {
    log(`adv: rssi=${ev.rssi} uuids=[${[...ev.uuids || []].join(",")}]`);
    if (ev.serviceData) {
      for (const [uuid, data] of ev.serviceData) {
        log(`adv serviceData ${uuid}: ${hex(data)}`);
      }
    }
    if (ev.manufacturerData) {
      for (const [id, data] of ev.manufacturerData) {
        log(`adv mfg 0x${id.toString(16)}: ${hex(data)}`);
      }
    }
  });
  try {
    await device.watchAdvertisements();
    log("watching advertisements…");
  } catch (e) {
    log(`watchAdvertisements failed: ${e.message}`);
  }
}

connectBtn.onclick = async () => {
  try {
    statusEl.textContent = t.status_scanning;
    logEl.textContent = "";

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: CANDIDATE_SERVICES
    });

    statusEl.textContent = t.status_selected(device.name);
    device.addEventListener("gattserverdisconnected",
      () => statusEl.textContent = t.status_disconnected);

    const server = await device.gatt.connect();
    statusEl.textContent = t.status_connected(device.name);

    await watchAdvertisements(device);
    await enumerateGatt(server);

    // Try reading battery level
    try {
      const service = await server.getPrimaryService("battery_service");
      const characteristic = await service.getCharacteristic("battery_level");
      const value = await characteristic.readValue();
      const battery = value.getUint8(0);
      batteryEl.textContent = t.battery(battery);
    } catch (e) {
      batteryEl.textContent = t.no_battery;
    }

  } catch (err) {
    statusEl.textContent = t.failed(err);
  }
};
