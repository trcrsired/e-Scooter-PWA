// -------------------------
// 1. Localization dictionary
// -------------------------
const i18n = {
  en: {
    title: "e-Scooter",
    connect: "Connect to scooter",
    disconnect: "Disconnect",
    status_idle: "Not connected",
    status_scanning: "Scanning for a device…",
    status_selected: name => `Selected ${name}`,
    status_connGatt: "Connecting (GATT)…",
    status_handshake: "Handshaking…",
    status_connected: name => `Connected to ${name}`,
    status_disconnected: "Disconnected",
    failed: err => `Failed: ${err}`,
    status_cancelled: "No device selected — tap Connect and choose your scooter. Wake it up and make sure it isn't already connected to another phone or the official app.",
    bt_off: "Bluetooth is off, unavailable, or access was denied. Turn Bluetooth on and allow the browser access, then try again.",
    bt_unsupported: "Web Bluetooth isn't available here. Use Chrome/Edge on Android or desktop, served over HTTPS (or localhost).",
    bt_gesture: "The browser blocked the device chooser. Tap Connect again.",
    settings: "Settings",
    settings_hint: "Credentials come from the Tuya cloud. Serving keys.json next to the app loads them automatically, or enter them here (stored only in this browser).",
    key_label: "Local key",
    devid_label: "Device ID",
    uuid_label: "Device UUID",
    save: "Save",
    saved: "Saved",
    missing: "Fill in local key, device ID and UUID, or add a keys.json",
    keys_loaded: name => `Loaded credentials for ${name}`,
    keys_none: "No keys.json found — open Settings and enter credentials.",
    wasm_ok: "crypto module loaded",
    wasm_missing: "tuya_crypto.wasm not found — run the build in cpp/",
    section_controls: "Controls",
    section_status: "Status",
    section_datapoints: "Datapoints (read-only)",
    observe_notice: "Observe-only mode: this app will not send any commands to the scooter. It only authenticates and displays the datapoints the scooter reports.",
    controls_empty: "Connect to the scooter to load its controls.",
    read_only: "read-only",
    send: "Send",
    diagnostics: "Diagnostics",
    clear_log: "Clear log",
    copy_log: "Copy log",
    copied: "Copied",
    on: "On",
    off: "Off",
  },
  zh: {
    title: "电动滑板车",
    connect: "连接滑板车",
    disconnect: "断开连接",
    status_idle: "未连接",
    status_scanning: "正在扫描设备…",
    status_selected: name => `已选择 ${name}`,
    status_connGatt: "正在连接（GATT）…",
    status_handshake: "正在握手…",
    status_connected: name => `已连接到 ${name}`,
    status_disconnected: "已断开",
    failed: err => `失败：${err}`,
    status_cancelled: "未选择设备 —— 请点击连接并选择你的滑板车。请唤醒它，并确认它未连接到其他手机或官方 App。",
    bt_off: "蓝牙已关闭、不可用，或权限被拒绝。请打开蓝牙并允许浏览器访问后重试。",
    bt_unsupported: "此环境不支持 Web 蓝牙。请使用 Android 或桌面版 Chrome/Edge，并通过 HTTPS（或 localhost）访问。",
    bt_gesture: "浏览器阻止了设备选择器。请再次点击连接。",
    settings: "设置",
    settings_hint: "凭据来自涂鸦云。将 keys.json 与应用一起提供会自动加载，也可在此手动填写（仅保存在本浏览器）。",
    key_label: "本地密钥",
    devid_label: "设备 ID",
    uuid_label: "设备 UUID",
    save: "保存",
    saved: "已保存",
    missing: "请填写本地密钥、设备 ID 与 UUID，或添加 keys.json",
    keys_loaded: name => `已加载 ${name} 的凭据`,
    keys_none: "未找到 keys.json —— 请打开设置在下方填写凭据。",
    wasm_ok: "加密模块已加载",
    wasm_missing: "未找到 tuya_crypto.wasm —— 请在 cpp/ 中构建",
    section_controls: "控制",
    section_status: "状态",
    section_datapoints: "数据点（只读）",
    observe_notice: "仅观察模式：本应用不会向滑板车发送任何指令，只进行认证并显示滑板车上报的数据点。",
    controls_empty: "连接滑板车后即可加载控制项。",
    read_only: "只读",
    send: "发送",
    diagnostics: "诊断",
    clear_log: "清空日志",
    copy_log: "复制日志",
    copied: "已复制",
    on: "开",
    off: "关",
  }
};

const lang = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
const t = i18n[lang];

// -------------------------
// 2. Element handles
// -------------------------
const $ = id => document.getElementById(id);
const logEl = $("log");
const statusEl = $("status");
const statusTextEl = $("statusText");
const connectBtn = $("connectBtn");
const controlsEl = $("controls");
const overlay = $("settingsOverlay");
const keyInput = $("keyInput");
const devIdInput = $("devIdInput");
const uuidInput = $("uuidInput");
const keysStatus = $("keysStatus");

// -------------------------
// 3. Localization of static UI
// -------------------------
$("title").textContent = t.title;
$("connectBtn").textContent = t.connect;
statusTextEl.textContent = t.status_idle;
$("settingsTitle").textContent = t.settings;
$("settingsHint").textContent = t.settings_hint;
$("keyLabel").textContent = t.key_label;
$("devIdLabel").textContent = t.devid_label;
$("uuidLabel").textContent = t.uuid_label;
$("saveKeysBtn").textContent = t.save;
$("diagSummary").textContent = t.diagnostics;
$("clearLogBtn").textContent = t.clear_log;
$("copyLogBtn").textContent = t.copy_log;
$("safetyNote").textContent = t.observe_notice;
document.documentElement.lang = lang;

// -------------------------
// 4. Helpers
// -------------------------
function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}
function hex(view) {
  const b = new Uint8Array(view.buffer || view, view.byteOffset || 0, view.byteLength || view.length);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join(" ");
}
function asciiBytes(str) {
  const s = String(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
function setStatus(text, state) {
  statusTextEl.textContent = text;
  statusEl.className = "status" + (state ? " " + state : "");
}

// -------------------------
// 5. WASM crypto + CBC built on the ECB primitive
// -------------------------
const Crypto = {
  ex: null,

  async load() {
    try {
      const resp = await fetch("tuya_crypto.wasm", { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer(), {});
      Crypto.ex = instance.exports;
      Crypto.ex.__wasm_call_ctors();
      log(t.wasm_ok);
      return true;
    } catch (e) {
      log(t.wasm_missing + " (" + e.message + ")");
      return false;
    }
  },

  mem() { return new Uint8Array(this.ex.memory.buffer); },

  setKey(k) {
    this.mem().set(k, this.ex.get_key_ptr());
    this.ex.aes128_set_key();
  },

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

  cbcEncrypt(key, iv, data) {
    this.setKey(key);
    const out = new Uint8Array(data.length);
    let prev = iv;
    for (let i = 0; i < data.length; i += 16) {
      const block = new Uint8Array(16);
      for (let j = 0; j < 16; j++) block[j] = data[i + j] ^ prev[j];
      const enc = this.encrypt(block);
      out.set(enc, i);
      prev = enc;
    }
    return out;
  },

  cbcDecrypt(key, iv, data) {
    this.setKey(key);
    const out = new Uint8Array(data.length);
    let prev = iv;
    for (let i = 0; i < data.length; i += 16) {
      const ct = data.subarray(i, i + 16);
      const dec = this.decrypt(ct);
      for (let j = 0; j < 16; j++) out[i + j] = dec[j] ^ prev[j];
      prev = ct;
    }
    return out;
  },

  md5(u8) {
    this.mem().set(u8, this.ex.get_in_ptr());
    this.ex.md5_digest(u8.length);
    return this.mem().slice(this.ex.get_md5_ptr(), this.ex.get_md5_ptr() + 16);
  }
};

// -------------------------
// 6. Credentials
// -------------------------
const LS_KEY = "escooter.local_key";
const LS_DEVID = "escooter.device_id";
const LS_UUID = "escooter.uuid";

let deviceSpec = null; // { functions, status, name }

function loadCreds() {
  return {
    localKey: keyInput.value.trim(),
    deviceId: devIdInput.value.trim(),
    uuid: uuidInput.value.trim(),
  };
}

function applyCreds(c) {
  keyInput.value = c.localKey || "";
  devIdInput.value = c.deviceId || "";
  uuidInput.value = c.uuid || "";
}

async function loadKeysFile() {
  try {
    const resp = await fetch("keys.json", { cache: "no-store" });
    if (!resp.ok) return null;
    const data = await resp.json();
    const devices = Object.values(data.devices || {});
    return devices.length ? devices[0] : null;
  } catch (_) { return null; }
}

keyInput.value = localStorage.getItem(LS_KEY) || "";
devIdInput.value = localStorage.getItem(LS_DEVID) || "";
uuidInput.value = localStorage.getItem(LS_UUID) || "";

// -------------------------
// 7. Settings sheet
// -------------------------
function openSettings() {
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("open"));
}
function closeSettings() {
  overlay.classList.remove("open");
  setTimeout(() => { overlay.hidden = true; }, 250);
}
$("settingsBtn").onclick = openSettings;
$("closeSettingsBtn").onclick = closeSettings;
overlay.addEventListener("click", e => { if (e.target === overlay) closeSettings(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSettings(); });

$("saveKeysBtn").onclick = () => {
  const c = loadCreds();
  localStorage.setItem(LS_KEY, c.localKey);
  localStorage.setItem(LS_DEVID, c.deviceId);
  localStorage.setItem(LS_UUID, c.uuid);
  keysStatus.textContent = t.saved;
  keysStatus.classList.remove("error");
  setTimeout(() => { keysStatus.textContent = ""; }, 2000);
};

// -------------------------
// 8. Datapoint spec -> UI
// -------------------------
const DT = TuyaDT;
const dpUi = new Map(); // dp_id -> [update fn]

function specToDt(type) {
  switch (String(type || "").toLowerCase()) {
    case "boolean": return DT.BOOL;
    case "enum": return DT.ENUM;
    case "value":
    case "integer": return DT.VALUE;
    case "string": return DT.STRING;
    case "bitmap": return DT.BITMAP;
    case "json":
    case "raw": return DT.RAW;
    default: return DT.VALUE;
  }
}

function parseValues(spec) {
  try { return JSON.parse(spec.values || "{}") || {}; } catch (_) { return {}; }
}

function registerDpEl(dpId, update) {
  if (!dpUi.has(dpId)) dpUi.set(dpId, []);
  dpUi.get(dpId).push(update);
}

function rawToDisplay(v, scale) { return scale ? v / Math.pow(10, scale) : v; }
function displayToRaw(v, scale) { return scale ? Math.round(v * Math.pow(10, scale)) : Math.round(v); }

function formatDpValue(dpDef, v) {
  const dt = specToDt(dpDef.type);
  const values = parseValues(dpDef);
  if (v instanceof Uint8Array) return hex(v);
  if (dt === DT.BOOL) return v ? t.on : t.off;
  if (dt === DT.ENUM) {
    const range = Array.isArray(values.range) ? values.range : [];
    return (range[v] !== undefined ? range[v] : v) + (values.unit ? " " + values.unit : "");
  }
  if (dt === DT.VALUE) {
    return rawToDisplay(v, Number(values.scale || 0)) + (values.unit ? " " + values.unit : "");
  }
  return String(v) + (values.unit ? " " + values.unit : "");
}

// Read-only tile: shows a datapoint's identity and its live reported value.
// Observe-only — there is deliberately no control element that can send.
function makeTile(dpDef) {
  const dpId = dpDef.dp_id;
  const tile = document.createElement("div");
  tile.className = "tile";

  const lab = document.createElement("div");
  lab.className = "tile-label";
  lab.textContent = dpDef.code || ("dp " + dpId);

  const meta = document.createElement("div");
  meta.className = "tile-meta";
  meta.textContent = "dp " + dpId + " · " + (dpDef.type || "?") + " · " + t.read_only;

  const val = document.createElement("div");
  val.className = "tile-value";
  val.textContent = "–";

  tile.appendChild(lab);
  tile.appendChild(meta);
  tile.appendChild(val);
  registerDpEl(dpId, v => { val.textContent = formatDpValue(dpDef, v); });
  return tile;
}

function sectionTitle(text) {
  const h = document.createElement("h2");
  h.textContent = text;
  return h;
}

// Observe-only: every datapoint (both the writable "functions" and the
// read-only "status" list) is rendered as a read-only tile. There is no
// element in the DOM that can send a command.
function buildControls(spec) {
  controlsEl.textContent = "";
  dpUi.clear();
  if (!spec) return;

  const all = [...(spec.functions || []), ...(spec.status || [])];
  if (!all.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t.controls_empty;
    controlsEl.appendChild(empty);
    return;
  }

  const sec = document.createElement("section");
  sec.className = "section";
  sec.appendChild(sectionTitle(t.section_datapoints));
  const tiles = document.createElement("div");
  tiles.className = "tiles";
  for (const dp of all) tiles.appendChild(makeTile(dp));
  sec.appendChild(tiles);
  controlsEl.appendChild(sec);
}

function onDp(dp) {
  log("← dp " + dp.id + " = " + (dp.value instanceof Uint8Array ? hex(dp.value) : dp.value));
  const handlers = dpUi.get(dp.id);
  if (handlers) for (const fn of handlers) fn(dp.value);
}

// -------------------------
// 9. BLE session
// -------------------------
let tuya = null;

const OPTIONAL_SERVICES = [
  ...TuyaBLE.SERVICE_UUIDS,
  // standard SIG services
  0x1800, 0x1801, 0x1802, 0x1804, 0x1805, 0x1808, 0x1809,
  0x180a, 0x180f, 0x1812, 0x1816, 0x181a, 0x181c, 0x1822,
  "battery_service", "device_information",
  // Tuya BLE
  0x1910, 0xa201, 0xfd50, 0xfd51,
  // common vendor / serial / DFU services
  0xfff0, 0xffe0, 0xffe5, 0xffe9, 0xffe1,
  0xfe95, 0xfe59, 0xfee7, 0xfeed,
  0x0001, 0xae00,
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC transparent serial
  "0000f000-0000-1000-8000-00805f9b34fb",
  "00010203-0405-0607-0809-0a0b0c0d1912", // Telink OTA
  "00010203-0405-0607-0809-0a0b0c0d2b11",
];

function setConnected(connected) {
  connectBtn.textContent = connected ? t.disconnect : t.connect;
  connectBtn.classList.toggle("is-disconnect", connected);
}

connectBtn.onclick = async () => {
  if (tuya) {
    tuya.disconnect();
    tuya = null;
    setConnected(false);
    setStatus(t.status_disconnected, "");
    return;
  }

  const creds = loadCreds();
  if (!creds.localKey || !creds.deviceId || !creds.uuid) {
    setStatus(t.missing, "is-error");
    openSettings();
    return;
  }
  if (!Crypto.ex) {
    setStatus(t.failed("crypto module not loaded"), "is-error");
    return;
  }
  if (!("bluetooth" in navigator)) {
    setStatus(t.bt_unsupported, "is-error");
    log("navigator.bluetooth is undefined (insecure context or unsupported browser)");
    return;
  }

  try {
    setStatus(t.status_scanning, "is-busy");
    logEl.textContent = "";

    // NOTE: requestDevice() must run inside the click's user gesture, so nothing
    // may be awaited before it.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: OPTIONAL_SERVICES,
    });
    setStatus(t.status_selected(device.name || device.id), "is-busy");

    tuya = new TuyaBLE(Crypto, {
      onLog: log,
      onDp,
      onReady: () => {
        setStatus(t.status_connected(device.name || device.id), "is-connected");
        setConnected(true);
      },
    });

    device.addEventListener("gattserverdisconnected", () => {
      setStatus(t.status_disconnected, "");
      setConnected(false);
      tuya = null;
    });

    setStatus(t.status_connGatt, "is-busy");
    await tuya.connect(device, creds);
  } catch (err) {
    log("error: " + err.name + ": " + err.message);
    if (err.name === "NotFoundError" && /cancel/i.test(err.message)) {
      // The chooser was dismissed (or showed no devices) — not a real failure.
      setStatus(t.status_cancelled, "");
    } else if (err.name === "NotFoundError") {
      setStatus(t.bt_off, "is-error");
    } else if (err.name === "SecurityError") {
      setStatus(t.bt_gesture, "is-error");
    } else {
      setStatus(t.failed(err.message), "is-error");
    }
    setConnected(false);
    tuya = null;
  }
};

$("clearLogBtn").onclick = () => { logEl.textContent = ""; };

$("copyLogBtn").onclick = async () => {
  const btn = $("copyLogBtn");
  try {
    await navigator.clipboard.writeText(logEl.textContent);
    btn.textContent = t.copied;
  } catch (_) {
    // Clipboard API needs HTTPS/permission; fall back to selecting the text.
    const r = document.createRange();
    r.selectNodeContents(logEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    btn.textContent = t.copied;
  }
  setTimeout(() => { btn.textContent = t.copy_log; }, 1500);
};

// -------------------------
// 10. Boot
// -------------------------
(async function boot() {
  const ok = await Crypto.load();
  const dev = await loadKeysFile();
  if (dev) {
    applyCreds({
      localKey: dev.local_key || "",
      deviceId: dev.device_id || "",
      uuid: dev.uuid || "",
    });
    deviceSpec = { functions: dev.functions, status: dev.status, name: dev.device_name };
    buildControls(deviceSpec);
    log(t.keys_loaded(dev.device_name || dev.device_id));
  } else {
    log(t.keys_none);
    buildControls(null);
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t.controls_empty;
    controlsEl.appendChild(empty);
  }
  if (!ok) log("(connect is disabled until the crypto module loads)");
  log("secure context: " + window.isSecureContext);
  if (!("bluetooth" in navigator)) {
    log(t.bt_unsupported);
  } else if (navigator.bluetooth.getAvailability) {
    navigator.bluetooth.getAvailability().then(a => { if (!a) log(t.bt_off); });
    if (navigator.bluetooth.addEventListener) {
      navigator.bluetooth.addEventListener("availabilitychanged", e => {
        log("bluetooth availability changed: " + e.value);
        if (!e.value) log(t.bt_off);
      });
    }
  }
})();
