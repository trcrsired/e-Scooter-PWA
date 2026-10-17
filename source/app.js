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
    controls_empty: "Connect to the scooter to load its controls.",
    read_only: "read-only",
    send: "Send",
    diagnostics: "Diagnostics",
    clear_log: "Clear log",
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
    controls_empty: "连接滑板车后即可加载控制项。",
    read_only: "只读",
    send: "发送",
    diagnostics: "诊断",
    clear_log: "清空日志",
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

function makeControl(fn) {
  const dpId = fn.dp_id;
  const dt = specToDt(fn.type);
  const name = fn.code || ("dp " + dpId);
  const values = parseValues(fn);

  let node;
  const send = (type, value) => { if (tuya) tuya.sendDp(dpId, type, value); };

  if (dt === DT.BOOL) {
    node = document.createElement("div");
    node.className = "switch";
    node.setAttribute("role", "switch");
    node.setAttribute("aria-checked", "false");
    node.onclick = () => {
      const next = node.getAttribute("aria-checked") !== "true";
      node.setAttribute("aria-checked", String(next));
      send(DT.BOOL, next);
    };
    registerDpEl(dpId, v => node.setAttribute("aria-checked", String(!!v)));

  } else if (dt === DT.ENUM) {
    const range = Array.isArray(values.range) ? values.range : [];
    if (range.length && range.length <= 4) {
      node = document.createElement("div");
      node.className = "segment";
      range.forEach((label, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.setAttribute("aria-pressed", "false");
        b.onclick = () => {
          [...node.children].forEach(x => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
          send(DT.ENUM, i);
        };
        node.appendChild(b);
      });
      registerDpEl(dpId, v => {
        [...node.children].forEach((x, i) => x.setAttribute("aria-pressed", String(i === v)));
      });
    } else {
      node = document.createElement("select");
      range.forEach((label, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = label;
        node.appendChild(o);
      });
      node.onchange = () => send(DT.ENUM, Number(node.value));
      registerDpEl(dpId, v => { node.value = String(v); });
    }

  } else if (dt === DT.VALUE) {
    const scale = Number(values.scale || 0);
    const min = values.min !== undefined ? rawToDisplay(Number(values.min), scale) : undefined;
    const max = values.max !== undefined ? rawToDisplay(Number(values.max), scale) : undefined;
    const step = values.step ? rawToDisplay(Number(values.step), scale) : Math.pow(10, -scale);

    node = document.createElement("div");
    node.className = "value-ctrl";
    let number, range = null;
    if (min !== undefined && max !== undefined && max > min) {
      range = document.createElement("input");
      range.type = "range";
      range.min = String(min); range.max = String(max); range.step = String(step || 1);
      range.onchange = () => {
        number.value = range.value;
        send(DT.VALUE, displayToRaw(Number(range.value), scale));
      };
      node.appendChild(range);
    }
    number = document.createElement("input");
    number.type = "number";
    number.step = String(step || 1);
    if (min !== undefined) number.min = String(min);
    if (max !== undefined) number.max = String(max);
    number.onchange = () => {
      if (range) range.value = number.value;
      send(DT.VALUE, displayToRaw(Number(number.value), scale));
    };
    node.appendChild(number);
    if (values.unit) {
      const u = document.createElement("span");
      u.className = "unit";
      u.textContent = values.unit;
      node.appendChild(u);
    }
    registerDpEl(dpId, v => {
      const d = String(rawToDisplay(v, scale));
      number.value = d;
      if (range) range.value = d;
    });

  } else if (dt === DT.STRING) {
    node = document.createElement("div");
    node.className = "inline";
    const input = document.createElement("input");
    input.type = "text";
    const b = document.createElement("button");
    b.className = "ghost";
    b.textContent = t.send;
    b.onclick = () => send(DT.STRING, input.value);
    node.appendChild(input);
    node.appendChild(b);
    registerDpEl(dpId, v => { input.value = String(v); });

  } else {
    node = document.createElement("span");
    registerDpEl(dpId, v => { node.textContent = v instanceof Uint8Array ? hex(v) : String(v); });
  }

  return { name, node };
}

function addRow(card, labelText, control, readOnly) {
  const row = document.createElement("div");
  row.className = "row";
  const label = document.createElement("div");
  label.className = "row-label";
  label.textContent = labelText;
  if (readOnly) {
    const tag = document.createElement("span");
    tag.className = "ro";
    tag.textContent = t.read_only;
    label.appendChild(tag);
  }
  row.appendChild(label);
  row.appendChild(control);
  card.appendChild(row);
}

function sectionTitle(text) {
  const h = document.createElement("h2");
  h.textContent = text;
  return h;
}

function buildControls(spec) {
  controlsEl.textContent = "";
  dpUi.clear();
  if (!spec) return;

  const functions = spec.functions || [];
  const status = spec.status || [];

  if (functions.length) {
    const sec = document.createElement("section");
    sec.className = "section";
    sec.appendChild(sectionTitle(t.section_controls));
    const card = document.createElement("div");
    card.className = "card";
    for (const fn of functions) {
      const { name, node } = makeControl(fn);
      addRow(card, name, node, false);
    }
    sec.appendChild(card);
    controlsEl.appendChild(sec);
  }

  if (status.length) {
    const sec = document.createElement("section");
    sec.className = "section";
    sec.appendChild(sectionTitle(t.section_status));
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    for (const st of status) {
      const values = parseValues(st);
      const scale = Number(values.scale || 0);
      const tile = document.createElement("div");
      tile.className = "tile";
      const lab = document.createElement("div");
      lab.className = "tile-label";
      lab.textContent = st.code || ("dp " + st.dp_id);
      const val = document.createElement("div");
      val.className = "tile-value";
      val.textContent = "–";
      tile.appendChild(lab);
      tile.appendChild(val);
      tiles.appendChild(tile);
      registerDpEl(st.dp_id, v => {
        val.textContent = (typeof v === "number" ? rawToDisplay(v, scale) : v) +
          (values.unit ? " " + values.unit : "");
      });
    }
    sec.appendChild(tiles);
    controlsEl.appendChild(sec);
  }

  if (!functions.length && !status.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t.controls_empty;
    controlsEl.appendChild(empty);
  }
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
  0x1800, 0x1801, 0x180a, 0x180f, 0x1910, 0xa201,
  0xfd50, 0xfff0, 0xffe0,
  "battery_service", "device_information",
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

  try {
    setStatus(t.status_scanning, "is-busy");
    logEl.textContent = "";

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
    log("error: " + err.message);
    setStatus(t.failed(err.message), "is-error");
    setConnected(false);
    tuya = null;
  }
};

$("clearLogBtn").onclick = () => { logEl.textContent = ""; };

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
})();
