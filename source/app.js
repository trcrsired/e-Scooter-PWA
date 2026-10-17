// -------------------------
// 0. Version — the single source of truth for "is the browser running the
//    latest build?". Bump this on EVERY change; it is shown in the app bar.
// -------------------------
const APP_VERSION = "0.7.7";

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
    settings_hint: "Credentials come from the Tuya cloud. Enter them here (stored only in this browser).",
    key_label: "Local key",
    devid_label: "Device ID",
    uuid_label: "Device UUID",
    save: "Save",
    saved: "Saved",
    sent: "Sent to scooter",
    missing: "Fill in local key, device ID and UUID",
    wasm_ok: "crypto module loaded",
    wasm_missing: "tuya_crypto.wasm not found — run the build in cpp/",
    section_controls: "Controls",
    section_status: "Status",
    section_datapoints: "Datapoints",
    write_notice: "Live mode: every change you confirm here is sent to the scooter. Only adjust settings you understand — the scooter can move, unlock, or change speed. When in doubt, disconnect first.",
    arm_label: "Enable sending commands",
    arm_hint: "Off: the app only reads. On: controls become live and can change the scooter.",
    controls_empty: "Connect to the scooter to load its controls.",
    read_only: "read-only",
    writable: "writable",
    send: "Send",
    confirm_title: "Send to scooter?",
    confirm_body: (dp, val) => `datapoint ${dp} → ${val}`,
    confirm_send: "Send",
    confirm_cancel: "Cancel",
    manual_title: "Manual datapoint",
    manual_hint: "Advanced: send a raw datapoint by id, type and value.",
    manual_id: "DP id",
    manual_type: "Type",
    manual_value: "Value",
    manual_send: "Send",
    diagnostics: "Diagnostics",
    clear_log: "Clear log",
    copy_log: "Copy log",
    copied: "Copied",
    on: "On",
    off: "Off",
    tab_ride: "Ride",
    tab_debug: "Debug",
    ride_scooter: "Scooter",
    trip: "Trip",
    max: "Max",
    avg: "Avg",
    time: "Time",
    gps_start: "Start tracking",
    gps_stop: "Stop tracking",
    gps_off: "GPS off",
    gps_waiting: "Acquiring GPS…",
    gps_tracking: "Tracking",
    gps_error: "GPS error",
    gps_unsupported: "Geolocation isn't available in this browser/context.",
    announce_title: "Speed announcements",
    every_s: "every (s)",
    times: "times",
    tts_off: "Voice off",
    tts_on: (n, m) => `Voice on · ${n}s` + (m > 0 ? " × " + m : " · unlimited"),
    tts_unavailable: "Speech synthesis unavailable",
    batt: "Battery",
    volt: "Voltage",
    temp: "Temp",
    mode_walk: "Walk",
    mode_eco: "Eco",
    mode_d: "D",
    mode_s: "S",
    mode_unknown: v => `Mode ${v}`,
    arm_needed: "Turn on \u201cEnable sending commands\u201d in Debug to change the mode.",
    credential_title: "Credential",
    lang_title: "Language",
    lang_label: "Interface language",
    voice_label: "Speech voice",
    voice_default: "Default voice",
    device_title: "Scooter",
    device_name_label: "Scooter name",
    device_pick_label: "Imported scooter",
    import_label: "Load JSON config",
    cred_hint: "Preferred: import your scooter's JSON from the Tuya IoT platform —",
    cred_help: "How to get your scooter's JSON",
    cred_manual: "Or enter the credentials manually:",
    cred_steps: [
      "Open iot.tuya.com and sign in with the same Tuya / Smart Life account that owns the scooter.",
      "Go to Cloud \u2192 Development and open your project (create a free one if you don't have any).",
      "In the project, link the scooter under Devices \u2192 Link Device \u2192 choose it from the app account.",
      "Open the scooter \u2192 Device Details (or API Explorer \u2192 Device Details) and copy the JSON response — it contains device_id, uuid and local_key.",
      "Save that JSON to a file and load it above. If the file also has the product's function/status spec, the controls are built automatically.",
    ],
    import_ok: name => `Loaded ${name}`,
    import_none: "No device found in that file.",
    import_err: msg => `Import failed: ${msg}`,
    device_add: "Add",
    device_remove: "Remove",
    warn_title: "Speed warning",
    warn_above: "warn above",
    warn_off: "Speed warning off",
    warn_at: (v, u) => `Warn above ${v} ${u}`,
    warn_over: (v, u) => `\u26a0 Too fast \u2014 ${v} ${u}`,
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
    settings_hint: "凭据来自涂鸦云，请在此手动填写（仅保存在本浏览器）。",
    key_label: "本地密钥",
    devid_label: "设备 ID",
    uuid_label: "设备 UUID",
    save: "保存",
    saved: "已保存",
    sent: "已发送到滑板车",
    missing: "请填写本地密钥、设备 ID 与 UUID",
    wasm_ok: "加密模块已加载",
    wasm_missing: "未找到 tuya_crypto.wasm —— 请在 cpp/ 中构建",
    section_controls: "控制",
    section_status: "状态",
    section_datapoints: "数据点",
    write_notice: "实时模式：你确认的每次更改都会发送到滑板车。请只调整你理解的项目 —— 滑板车可能会移动、解锁或改变速度。不确定时请先断开连接。",
    arm_label: "启用命令发送",
    arm_hint: "关闭：仅读取。开启：控制项生效，可改变滑板车状态。",
    controls_empty: "连接滑板车后即可加载控制项。",
    read_only: "只读",
    writable: "可写",
    send: "发送",
    confirm_title: "发送到滑板车？",
    confirm_body: (dp, val) => `数据点 ${dp} → ${val}`,
    confirm_send: "发送",
    confirm_cancel: "取消",
    manual_title: "手动数据点",
    manual_hint: "高级：按 id、类型、数值发送原始数据点。",
    manual_id: "数据点 id",
    manual_type: "类型",
    manual_value: "数值",
    manual_send: "发送",
    diagnostics: "诊断",
    clear_log: "清空日志",
    copy_log: "复制日志",
    copied: "已复制",
    on: "开",
    off: "关",
    tab_ride: "骑行",
    tab_debug: "调试",
    ride_scooter: "滑板车",
    trip: "里程",
    max: "最高",
    avg: "平均",
    time: "时间",
    gps_start: "开始定位",
    gps_stop: "停止定位",
    gps_off: "定位未开启",
    gps_waiting: "正在获取定位…",
    gps_tracking: "定位中",
    gps_error: "定位错误",
    gps_unsupported: "此浏览器/环境不支持定位。",
    announce_title: "语音播报",
    every_s: "间隔（秒）",
    times: "次数",
    tts_off: "语音关闭",
    tts_on: (n, m) => `语音开启 · ${n} 秒` + (m > 0 ? " × " + m : " · 不限次数"),
    tts_unavailable: "此环境不支持语音合成",
    batt: "电量",
    volt: "电压",
    temp: "温度",
    mode_walk: "步行",
    mode_eco: "节能",
    mode_d: "行驶",
    mode_s: "运动",
    mode_unknown: v => `模式 ${v}`,
    arm_needed: "请先在调试页开启“启用发送命令”后再切换模式。",
    credential_title: "凭据",
    lang_title: "语言",
    lang_label: "界面语言",
    voice_label: "语音",
    voice_default: "默认语音",
    device_title: "滑板车",
    device_name_label: "滑板车名称",
    device_pick_label: "已导入的滑板车",
    import_label: "加载 JSON 配置",
    cred_hint: "推荐：从涂鸦 IoT 平台导入滑板车的 JSON ——",
    cred_help: "如何获取滑板车 JSON",
    cred_manual: "或手动填写凭据：",
    cred_steps: [
      "打开 iot.tuya.com，用拥有该滑板车的涂鸦 / 智能生活账号登录。",
      "进入 云开发 \u2192 Development，打开你的项目（没有就免费新建一个）。",
      "在项目里关联滑板车：Devices \u2192 Link Device \u2192 从 App 账号中选择它。",
      "打开滑板车 \u2192 Device Details（或 API Explorer \u2192 Device Details），复制返回的 JSON —— 其中包含 device_id、uuid 与 local_key。",
      "把该 JSON 保存成文件后在此加载。若文件还包含产品的 function/status 定义，则控件会自动生成。",
    ],
    import_ok: name => `已加载 ${name}`,
    import_none: "文件中未找到设备。",
    import_err: msg => `导入失败：${msg}`,
    device_add: "添加",
    device_remove: "删除",
    warn_title: "速度警告",
    warn_above: "超过",
    warn_off: "速度警告已关闭",
    warn_at: (v, u) => `超过 ${v} ${u} 时警告`,
    warn_over: (v, u) => `\u26a0 超速 —— ${v} ${u}`,
  }
};

const LS_LANG = "escooter.lang";
function detectLang() {
  return (navigator.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
}
let lang = localStorage.getItem(LS_LANG) || detectLang();
if (!i18n[lang]) lang = detectLang();
let t = i18n[lang];

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
const confirmOverlay = $("confirmOverlay");
const confirmBody = $("confirmBody");

// -------------------------
// 3. Localization of static UI
// -------------------------
function applyStatic() {
  document.documentElement.lang = lang;
  $("title").textContent = t.title;
  $("connectBtn").textContent = t.connect;
  $("settingsTitle").textContent = t.settings;
  $("settingsHint").textContent = t.settings_hint;
  $("langTitle").textContent = t.lang_title;
  $("langLabel").textContent = t.lang_label;
  $("voiceLabel").textContent = t.voice_label;
  $("deviceTitle").textContent = t.device_title;
  $("deviceNameLabel").textContent = t.device_name_label;
  $("devicePickLabel").textContent = t.device_pick_label;
  $("deviceAddBtn").textContent = t.device_add;
  $("deviceRemoveBtn").textContent = t.device_remove;
  $("credTitle").textContent = t.credential_title;
  $("credHintText").textContent = t.cred_hint;
  $("credHelpSummary").textContent = t.cred_help;
  $("credManualNote").textContent = t.cred_manual;
  const credSteps = $("credSteps");
  credSteps.textContent = "";
  for (const s of t.cred_steps) {
    const li = document.createElement("li");
    li.textContent = s;
    credSteps.appendChild(li);
  }
  $("keyLabel").textContent = t.key_label;
  $("devIdLabel").textContent = t.devid_label;
  $("uuidLabel").textContent = t.uuid_label;
  $("importLabel").textContent = t.import_label;
  $("saveKeysBtn").textContent = t.save;
  $("diagSummary").textContent = t.diagnostics;
  $("clearLogBtn").textContent = t.clear_log;
  $("copyLogBtn").textContent = t.copy_log;
  $("safetyNote").textContent = t.write_notice;
  $("safetyNote").classList.add("warn");
  $("confirmTitle").textContent = t.confirm_title;
  $("confirmCancelBtn").textContent = t.confirm_cancel;
  $("confirmSendBtn").textContent = t.confirm_send;
  $("version").textContent = "v" + APP_VERSION;
  $("tabRide").textContent = t.tab_ride;
  $("tabDebug").textContent = t.tab_debug;
  $("rideScooterTitle").textContent = t.ride_scooter;
  $("lblTrip").textContent = t.trip;
  $("lblMax").textContent = t.max;
  $("lblAvg").textContent = t.avg;
  $("lblTime").textContent = t.time;
  $("announceTitle").textContent = t.announce_title;
  $("lblEvery").textContent = t.every_s;
  $("lblTimes").textContent = t.times;
  $("warnTitle").textContent = t.warn_title;
  $("lblWarnAbove").textContent = t.warn_above;
  $("langSelect").value = lang;
}
applyStatic();
statusTextEl.textContent = t.status_idle;
$("rideGpsState").textContent = t.gps_off;
$("gpsBtn").textContent = t.gps_start;
$("ttsState").textContent = t.tts_off;

// -------------------------
// 4. Helpers
// -------------------------
function log(msg) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}
let _toastTimer = null;
function toast(msg) {
  const el = $("toast");
  if (!el) { log(msg); return; }
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("open"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove("open");
    setTimeout(() => { el.hidden = true; }, 220);
  }, 2800);
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

keyInput.value = localStorage.getItem(LS_KEY) || "";devIdInput.value = localStorage.getItem(LS_DEVID) || "";
uuidInput.value = localStorage.getItem(LS_UUID) || "";

// -------------------------
// 7. Settings sheet
// -------------------------
function openSettings() {
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("open"));
  // Voice lists are sometimes empty until the engine has warmed up; refresh.
  if (typeof populateVoices === "function") populateVoices();
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
  updateActiveDevice({ local_key: c.localKey, device_id: c.deviceId, uuid: c.uuid });
  keysStatus.textContent = t.saved;
  keysStatus.classList.remove("error");
  setTimeout(() => { keysStatus.textContent = ""; }, 2000);
};

// -------------------------
// 7b. Scooter list + importing a Tuya / keys.json config from the UI
// -------------------------
const LS_NAME = "escooter.device_name";
const LS_DEVICES = "escooter.devices";
const LS_ACTIVE = "escooter.active";
const importStatusEl = $("importStatus");
let importedDevices = [];
let activeIndex = 0;

function deviceLabel(d, i) {
  return (d && (d.device_name || d.name || d.model)) || ("Scooter " + (i + 1));
}
// Device id / uuid keys used for matching imports to saved profiles. The Tuya
// device list reports the id under "id", not "device_id", so both are accepted.
function deviceKey(d) { return String((d && (d.device_id || d.deviceId || d.id)) || "").toLowerCase(); }
function deviceUuid(d) { return String((d && d.uuid) || "").toLowerCase(); }
function sameDevice(a, b) {
  const ka = deviceKey(a), kb = deviceKey(b);
  if (ka && kb && ka === kb) return true;
  const ua = deviceUuid(a), ub = deviceUuid(b);
  return !!(ua && ub && ua === ub);
}
// Never clobber a profile's existing value with an empty one from a file
// (Tuya's device list returns local_key: "").
function mergeDeviceFields(existing, incoming) {
  const out = Object.assign({}, existing);
  for (const [k, v] of Object.entries(incoming)) {
    if (v === "" || v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function collectDevices(data) {
  let arr = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.result)) arr = data.result;
    else if (Array.isArray(data.devices)) arr = data.devices;
    else if (data.result && Array.isArray(data.result.devices)) arr = data.result.devices;
    else if (data.devices && typeof data.devices === "object") arr = Object.values(data.devices);
    else if (data.result && data.result.devices && typeof data.result.devices === "object") arr = Object.values(data.result.devices);
    else if (data.result && typeof data.result === "object") arr = [data.result];
    else arr = [data];
  }
  return arr.filter(d => d && typeof d === "object" && !Array.isArray(d) &&
    (d.local_key || d.localKey || d.device_id || d.deviceId || d.id || d.functions || d.status));
}

function persistDevices() {
  localStorage.setItem(LS_DEVICES, JSON.stringify(importedDevices));
  if (importedDevices[activeIndex]) localStorage.setItem(LS_ACTIVE, String(activeIndex));
}
function ensureDevices() {
  if (!importedDevices.length) {
    importedDevices = [{ device_name: "Scooter 1", local_key: "", device_id: "", uuid: "" }];
    activeIndex = 0;
    persistDevices();
  }
}
function populateDeviceSelect() {
  const sel = $("deviceSelect");
  sel.textContent = "";
  importedDevices.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = deviceLabel(d, i);
    sel.appendChild(o);
  });
  sel.value = String(activeIndex);
}
function loadDeviceIntoForm(dev) {
  keyInput.value = dev.local_key || "";
  devIdInput.value = dev.device_id || "";
  uuidInput.value = dev.uuid || "";
  $("deviceNameInput").value = dev.device_name || "";
  $("deviceName").textContent = dev.device_name || "";
}

// Pick the scooter at index i as the active one and load it everywhere.
function selectDevice(i) {
  ensureDevices();
  if (!(i >= 0 && i < importedDevices.length)) i = 0;
  activeIndex = i;
  const dev = importedDevices[i];
  persistDevices();
  populateDeviceSelect();
  loadDeviceIntoForm(dev);
  localStorage.setItem(LS_KEY, keyInput.value);
  localStorage.setItem(LS_DEVID, devIdInput.value);
  localStorage.setItem(LS_UUID, uuidInput.value);
  if (dev.functions || dev.status) {
    deviceSpec = { functions: dev.functions || [], status: dev.status || [], name: deviceLabel(dev, i) };
  }
  buildControls(deviceSpec);
}

// Edit the active scooter's fields and persist.
function updateActiveDevice(patch) {
  const dev = importedDevices[activeIndex];
  if (!dev) return;
  Object.assign(dev, patch);
  persistDevices();
  if (patch.device_name !== undefined) {
    $("deviceName").textContent = patch.device_name;
    populateDeviceSelect();
  }
  localStorage.setItem(LS_KEY, dev.local_key || "");
  localStorage.setItem(LS_DEVID, dev.device_id || "");
  localStorage.setItem(LS_UUID, dev.uuid || "");
}

function mergeImported(dev, i) {
  const out = {
    device_name: deviceLabel(dev, i),
    local_key: dev.local_key || dev.localKey || "",
    device_id: dev.device_id || dev.deviceId || dev.id || "",
    uuid: dev.uuid || "",
  };
  if (dev.functions) out.functions = dev.functions;
  if (dev.status) out.status = dev.status;
  return out;
}

function importConfig(data) {
  const list = collectDevices(data);
  if (!list.length) throw new Error("unrecognised file");

  ensureDevices();
  let focus = activeIndex;
  for (let i = 0; i < list.length; i++) {
    const dev = mergeImported(list[i], i);
    const at = importedDevices.findIndex(d => sameDevice(d, dev));
    if (at >= 0) {
      importedDevices[at] = mergeDeviceFields(importedDevices[at], dev);
      focus = at;
    } else {
      importedDevices.push(dev);
      focus = importedDevices.length - 1;
    }
  }
  activeIndex = focus;
  persistDevices();
  populateDeviceSelect();
  selectDevice(activeIndex);

  importStatusEl.textContent = t.import_ok(importedDevices[activeIndex].device_name);
  importStatusEl.classList.remove("error");
  setTimeout(() => { importStatusEl.textContent = ""; }, 3000);
  log("imported " + list.length + " scooter(s); list now has " + importedDevices.length);
  if (!keyInput.value) log("note: no local_key for this scooter — enter it under Credential before connecting");
}

$("importInput").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    importConfig(JSON.parse(await file.text()));
  } catch (err) {
    importStatusEl.textContent = t.import_err(err && err.message ? err.message : err);
    importStatusEl.classList.add("error");
  }
  e.target.value = "";
});

$("deviceSelect").addEventListener("change", () => selectDevice(Number($("deviceSelect").value)));

$("deviceAddBtn").addEventListener("click", () => {
  ensureDevices();
  importedDevices.push({ device_name: "Scooter " + (importedDevices.length + 1), local_key: "", device_id: "", uuid: "" });
  activeIndex = importedDevices.length - 1;
  selectDevice(activeIndex);
  $("deviceNameInput").focus();
});

$("deviceRemoveBtn").addEventListener("click", () => {
  if (importedDevices.length <= 1) {
    importedDevices = [];
    ensureDevices();
  } else {
    importedDevices.splice(activeIndex, 1);
    if (activeIndex >= importedDevices.length) activeIndex = importedDevices.length - 1;
  }
  selectDevice(activeIndex);
});

$("deviceNameInput").addEventListener("change", () => updateActiveDevice({ device_name: $("deviceNameInput").value.trim() }));
$("keyInput").addEventListener("change", () => updateActiveDevice({ local_key: keyInput.value.trim() }));
$("devIdInput").addEventListener("change", () => updateActiveDevice({ device_id: devIdInput.value.trim() }));
$("uuidInput").addEventListener("change", () => updateActiveDevice({ uuid: uuidInput.value.trim() }));

// Restore the saved scooter list from this browser.
function restoreDevices() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_DEVICES) || "[]");
    if (Array.isArray(saved) && saved.length) importedDevices = saved;
  } catch (_) {}
  const hadSavedList = importedDevices.length > 0;
  ensureDevices();

  // One-time migration: older versions stored a single scooter's credentials in
  // escooter.local_key / .device_id / .uuid. Fold them into the list so the
  // chosen profile still has its keys after this multi-device refactor.
  const legacy = {
    local_key: localStorage.getItem(LS_KEY) || "",
    device_id: localStorage.getItem(LS_DEVID) || "",
    uuid: localStorage.getItem(LS_UUID) || "",
  };
  const hasLegacy = !!(legacy.local_key || legacy.device_id || legacy.uuid);
  if (hasLegacy && !hadSavedList) {
    Object.assign(importedDevices[0], legacy, {
      device_name: localStorage.getItem(LS_NAME) || importedDevices[0].device_name || "Scooter 1",
    });
    persistDevices();
    log("migrated your saved credentials into profile 1");
  } else if (hasLegacy && legacy.device_id) {
    const match = importedDevices.find(d => !d.local_key && deviceKey(d) === legacy.device_id.toLowerCase());
    if (match) { match.local_key = legacy.local_key; match.uuid = match.uuid || legacy.uuid; persistDevices(); }
  }

  // Pick the last active profile. Match by device id or uuid, and guard against
  // an empty saved id matching a blank profile (which would override the saved
  // active index).
  const savedId = (localStorage.getItem(LS_DEVID) || "").toLowerCase();
  let idx = savedId
    ? importedDevices.findIndex(d => deviceKey(d) === savedId || deviceUuid(d) === savedId)
    : -1;
  if (idx < 0) idx = Number(localStorage.getItem(LS_ACTIVE) || 0);
  if (!(idx >= 0 && idx < importedDevices.length)) idx = 0;
  selectDevice(idx);
  const dev = importedDevices[activeIndex];
  if (dev && (dev.functions || dev.status)) {
    deviceSpec = { functions: dev.functions || [], status: dev.status || [], name: deviceLabel(dev, activeIndex) };
  }
}

// -------------------------
// 8. Datapoint spec -> UI
// -------------------------
const DT = TuyaDT;
const DT_NAMES = Object.fromEntries(Object.entries(DT).map(([k, v]) => [v, k]));
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
  if (lastDp.has(dpId)) update(lastDp.get(dpId)); // replay the last known value
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
// Used for status datapoints and for every datapoint while commands are disarmed.
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

// ---- confirmation for outgoing commands (non-blocking) ----
let _confirmResolve = null;
function askConfirm(label, valueText) {
  if (!tuya) return Promise.resolve(false);
  confirmBody.textContent = t.confirm_body(label, valueText);
  confirmOverlay.hidden = false;
  requestAnimationFrame(() => confirmOverlay.classList.add("open"));
  return new Promise(resolve => { _confirmResolve = resolve; });
}
function closeConfirm(result) {
  confirmOverlay.classList.remove("open");
  setTimeout(() => { confirmOverlay.hidden = true; }, 250);
  const r = _confirmResolve; _confirmResolve = null;
  if (r) r(result);
}
$("confirmCancelBtn").onclick = () => closeConfirm(false);
$("confirmSendBtn").onclick = () => closeConfirm(true);
confirmOverlay.addEventListener("click", e => { if (e.target === confirmOverlay) closeConfirm(false); });

// The ONLY function that writes to the scooter. It requires the arm-switch to
// be on (tuya.allowWrites), shows a confirmation, and reverts the control if
// the user declines.
function requestSend(dpId, dt, rawValue, displayText, revert) {
  if (!tuya) { toast(t.status_disconnected); return; }
  if (!armed) { toast(t.arm_needed); return; }
  askConfirm("dp " + dpId, displayText).then(ok => {
    if (!ok) { if (revert) revert(); return; }
    log("→ dp " + dpId + " = " + (rawValue instanceof Uint8Array ? hex(rawValue) : rawValue));
    try {
      tuya.sendDp(dpId, dt, rawValue);
      toast(t.sent);
    } catch (e) {
      log("send failed: " + (e && e.message ? e.message : e));
      toast("send failed: " + (e && e.message ? e.message : e));
    }
  });
}

// Interactive control for a writable (function) datapoint.
function makeControl(dpDef) {
  const dpId = dpDef.dp_id;
  const dt = specToDt(dpDef.type);
  const values = parseValues(dpDef);

  const tile = document.createElement("div");
  tile.className = "tile tile-control";

  const lab = document.createElement("div");
  lab.className = "tile-label";
  lab.textContent = dpDef.code || ("dp " + dpId);

  const meta = document.createElement("div");
  meta.className = "tile-meta";
  meta.textContent = "dp " + dpId + " · " + (dpDef.type || "?") + " · " + t.writable;

  const val = document.createElement("div");
  val.className = "tile-value";
  val.textContent = "–";

  tile.appendChild(lab);
  tile.appendChild(meta);

  let apply = function () {};

  if (dt === DT.BOOL) {
    const wrap = document.createElement("label");
    wrap.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    const knob = document.createElement("span");
    knob.className = "slider";
    wrap.appendChild(input);
    wrap.appendChild(knob);
    input.addEventListener("change", () => {
      const want = input.checked ? 1 : 0;
      requestSend(dpId, DT.BOOL, want, input.checked ? t.on : t.off,
        () => { input.checked = !input.checked; });
    });
    apply = v => { input.checked = !!v; };
    tile.appendChild(wrap);
    tile.appendChild(val);
  } else if (dt === DT.ENUM) {
    const range = Array.isArray(values.range) ? values.range : [];
    const sel = document.createElement("select");
    sel.className = "control-select";
    range.forEach((label, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      const v = Number(sel.value);
      requestSend(dpId, DT.ENUM, v, formatDpValue(dpDef, v), null);
    });
    apply = v => { sel.value = String(v); };
    tile.appendChild(sel);
    tile.appendChild(val);
  } else if (dt === DT.VALUE || dt === DT.BITMAP) {
    const scale = Number(values.scale || 0);
    const step = scale ? Math.pow(10, -scale) : 1;
    const num = document.createElement("input");
    num.type = "number";
    num.className = "control-num";
    num.step = String(step);
    if (values.min !== undefined) num.min = String(rawToDisplay(Number(values.min), scale));
    if (values.max !== undefined) num.max = String(rawToDisplay(Number(values.max), scale));
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = t.send;
    btn.onclick = () => {
      const raw = displayToRaw(Number(num.value), scale);
      requestSend(dpId, dt, raw, formatDpValue(dpDef, raw), null);
    };
    apply = v => { if (document.activeElement !== num) num.value = String(rawToDisplay(v, scale)); };
    const row = document.createElement("div");
    row.className = "control-row";
    row.appendChild(num);
    row.appendChild(btn);
    tile.appendChild(row);
    tile.appendChild(val);
  } else {
    // string / raw: free-form bytes
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "control-num";
    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = t.send;
    btn.onclick = () => {
      const bytes = new TextEncoder().encode(inp.value);
      requestSend(dpId, dt, bytes, inp.value, null);
    };
    apply = v => { if (document.activeElement !== inp) inp.value = v instanceof Uint8Array ? hex(v) : String(v); };
    const row = document.createElement("div");
    row.className = "control-row";
    row.appendChild(inp);
    row.appendChild(btn);
    tile.appendChild(row);
    tile.appendChild(val);
  }

  registerDpEl(dpId, v => { val.textContent = formatDpValue(dpDef, v); apply(v); });
  return tile;
}

// ---- global control state ----
// Sending is armed by default; the user can turn it off and that choice is
// remembered. Each send still shows a confirmation.
let armed = localStorage.getItem("escooter.armed") !== "0";
const lastDp = new Map();        // dp_id -> last reported value
const observed = new Set();      // dp_ids seen on the wire
let specIds = new Set();         // dp_ids described by the loaded spec

function armSwitchEl() {
  const tile = document.createElement("div");
  tile.className = "tile tile-control arm" + (armed ? " on" : "");

  const lab = document.createElement("div");
  lab.className = "tile-label";
  lab.textContent = t.arm_label;

  const hint = document.createElement("div");
  hint.className = "tile-meta";
  hint.textContent = t.arm_hint;

  const wrap = document.createElement("label");
  wrap.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = armed;
  input.disabled = !tuya;
  const knob = document.createElement("span");
  knob.className = "slider";
  wrap.appendChild(input);
  wrap.appendChild(knob);
  input.addEventListener("change", () => {
    armed = input.checked;
    localStorage.setItem("escooter.armed", armed ? "1" : "0");
    if (tuya) tuya.allowWrites = armed;
    log("commands " + (armed ? "ENABLED" : "disabled"));
    buildControls(deviceSpec);
  });

  tile.appendChild(lab);
  tile.appendChild(hint);
  tile.appendChild(wrap);
  return tile;
}

function addObservedTile(id) {
  if (specIds.has(id)) return; // already shown via the spec
  const el = document.getElementById("observedTiles");
  if (!el || el.querySelector('[data-dp="' + id + '"]')) return;
  const tile = makeTile({ dp_id: id, type: "observed", code: "" });
  tile.dataset.dp = String(id);
  el.appendChild(tile);
}

function buildManual() {
  const sec = document.createElement("section");
  sec.className = "section";
  sec.appendChild(sectionTitle(t.manual_title));

  const hint = document.createElement("div");
  hint.className = "tile-meta manual-hint";
  hint.textContent = t.manual_hint;
  sec.appendChild(hint);

  const idIn = document.createElement("input");
  idIn.type = "number";
  idIn.className = "control-num small";
  idIn.placeholder = t.manual_id;

  const typeSel = document.createElement("select");
  typeSel.className = "control-select";
  for (const name of ["boolean", "value", "enum", "string", "bitmap", "raw"]) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    typeSel.appendChild(o);
  }

  const valIn = document.createElement("input");
  valIn.type = "text";
  valIn.className = "control-num";
  valIn.placeholder = t.manual_value;

  const btn = document.createElement("button");
  btn.className = "ghost";
  btn.textContent = t.manual_send;
  btn.disabled = !armed;
  btn.onclick = () => {
    const id = Number(idIn.value);
    if (!armed || !tuya || !Number.isFinite(id)) return;
    const dt = specToDt(typeSel.value);
    let raw;
    if (dt === DT.BOOL) raw = /^(1|true|on|yes)$/i.test(valIn.value.trim()) ? 1 : 0;
    else if (dt === DT.VALUE || dt === DT.ENUM || dt === DT.BITMAP) raw = parseInt(valIn.value, 10) || 0;
    else raw = new TextEncoder().encode(valIn.value);
    requestSend(id, dt, raw, valIn.value, null);
  };

  const fields = document.createElement("div");
  fields.className = "control-fields";
  fields.appendChild(idIn);
  fields.appendChild(typeSel);
  fields.appendChild(valIn);
  fields.appendChild(btn);
  sec.appendChild(fields);
  return sec;
}

// Build the whole controls area: the arm-switch, then spec-driven controls
// (interactive only when armed), status tiles, live observed tiles, and a
// manual sender for datapoints we don't have a spec for yet.
function buildControls(spec) {
  controlsEl.textContent = "";
  dpUi.clear();

  const funcs = (spec && spec.functions) || [];
  const status = (spec && spec.status) || [];
  specIds = new Set([...funcs, ...status].map(d => d.dp_id));

  const armSec = document.createElement("section");
  armSec.className = "section";
  const armWrap = document.createElement("div");
  armWrap.className = "tiles";
  armWrap.appendChild(armSwitchEl());
  armSec.appendChild(armWrap);
  controlsEl.appendChild(armSec);

  if (funcs.length) {
    const sec = document.createElement("section");
    sec.className = "section";
    sec.appendChild(sectionTitle(t.section_controls));
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    for (const dp of funcs) tiles.appendChild(armed ? makeControl(dp) : makeTile(dp));
    sec.appendChild(tiles);
    controlsEl.appendChild(sec);
  }

  if (status.length) {
    const sec = document.createElement("section");
    sec.className = "section";
    sec.appendChild(sectionTitle(t.section_status));
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    for (const dp of status) tiles.appendChild(makeTile(dp));
    sec.appendChild(tiles);
    controlsEl.appendChild(sec);
  }

  const obsSec = document.createElement("section");
  obsSec.className = "section";
  obsSec.appendChild(sectionTitle(t.section_datapoints));
  const obsTiles = document.createElement("div");
  obsTiles.className = "tiles";
  obsTiles.id = "observedTiles";
  obsSec.appendChild(obsTiles);
  controlsEl.appendChild(obsSec);
  for (const id of observed) addObservedTile(id);

  controlsEl.appendChild(buildManual());
}

function onDp(dp) {
  lastDp.set(dp.id, dp.value);
  observed.add(dp.id);
  log("← dp " + dp.id + " (" + (DT_NAMES[dp.type] || dp.type) + ") = " +
    (dp.value instanceof Uint8Array ? hex(dp.value) : dp.value));
  const handlers = dpUi.get(dp.id);
  if (handlers) for (const fn of handlers) fn(dp.value);
  addObservedTile(dp.id);
  updateRideCard(dp.id, dp.value);
  updateGear(dp.id, dp.value, dp.type);
}

// -------------------------
// 8b. Ride view: GPS speed, units, scooter read-outs, voice
// -------------------------
const UNITS = {
  kmh: { speed: 1, speedLabel: "km/h", dist: 0.001, distLabel: "km", distDec: 2 },
  mph: { speed: 0.621371, speedLabel: "mph", dist: 0.000621371, distLabel: "mi", distDec: 2 },
  ms: { speed: 0.277778, speedLabel: "m/s", dist: 1, distLabel: "m", distDec: 1 },
};
const LS_UNIT = "escooter.unit";
let unit = localStorage.getItem(LS_UNIT) || "kmh";
if (!UNITS[unit]) unit = "kmh";

const unitBtns = { kmh: $("unitKmh"), mph: $("unitMph"), ms: $("unitMs") };
function setUnit(u) {
  if (!UNITS[u]) return;
  unit = u;
  localStorage.setItem(LS_UNIT, u);
  for (const [k, b] of Object.entries(unitBtns)) b.classList.toggle("is-active", k === u);
  $("rideSpeedUnit").textContent = UNITS[u].speedLabel;
  $("rideMaxUnit").textContent = UNITS[u].speedLabel;
  $("rideAvgUnit").textContent = UNITS[u].speedLabel;
  $("rideTripUnit").textContent = UNITS[u].distLabel;
  Geo.render();
  if (typeof updateWarnUi === "function") updateWarnUi();
}
for (const [u, b] of Object.entries(unitBtns)) b.onclick = () => setUnit(u);

// ---- speed warning ----
const LS_WARN = "escooter.warn";
const LS_WARNKMH = "escooter.warn_kmh";
const Warn = {
  on: localStorage.getItem(LS_WARN) === "1",
  kmh: Number(localStorage.getItem(LS_WARNKMH)) || 25,
  was: false,
};
const warnToggle = $("warnToggle");
const warnSpeed = $("warnSpeed");
function warnDisplay() { return Math.round(Warn.kmh * UNITS[unit].speed); }
function updateWarnUi() {
  $("warnUnit").textContent = UNITS[unit].speedLabel;
  if (document.activeElement !== warnSpeed) warnSpeed.value = String(warnDisplay());
  warnToggle.checked = Warn.on;
  $("warnState").textContent = Warn.on ? t.warn_at(warnDisplay(), UNITS[unit].speedLabel) : t.warn_off;
}
warnToggle.addEventListener("change", () => {
  Warn.on = warnToggle.checked;
  localStorage.setItem(LS_WARN, Warn.on ? "1" : "0");
  Warn.was = false;
  updateWarnUi();
});
warnSpeed.addEventListener("change", () => {
  const v = Math.max(1, Number(warnSpeed.value) || 1);
  Warn.kmh = v / UNITS[unit].speed;
  localStorage.setItem(LS_WARNKMH, String(Warn.kmh));
  updateWarnUi();
});
function checkSpeedWarn() {
  const U = UNITS[unit];
  const over = Warn.on && Geo.running && Geo.speedKmh > Warn.kmh;
  $("rideSpeed").classList.toggle("is-warn", over);
  if (over && !Warn.was) {
    Warn.was = true;
    toast(t.warn_over(Math.round(Geo.speedKmh * U.speed), U.speedLabel));
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (_) {} }
  } else if (!over) {
    Warn.was = false;
  }
}
updateWarnUi();

function haversine(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function fmtTime(secs) {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return m + ":" + String(s).padStart(2, "0");
}

const Geo = {
  watchId: null, running: false, lastPos: null, timer: null,
  tripM: 0, maxKmh: 0, sumKmh: 0, samples: 0, startedAt: 0, speedKmh: 0,
  start() {
    if (!("geolocation" in navigator)) { log(t.gps_unsupported); return; }
    this.tripM = 0; this.maxKmh = 0; this.sumKmh = 0; this.samples = 0;
    this.speedKmh = 0; this.lastPos = null;
    this.startedAt = Date.now(); this.running = true;
    $("gpsBtn").textContent = t.gps_stop;
    $("rideGpsState").textContent = t.gps_waiting;
    this.timer = setInterval(() => this.render(), 1000);
    this.watchId = navigator.geolocation.watchPosition(
      (p) => this.onPos(p),
      (e) => { log("gps error: " + (e && e.message)); $("rideGpsState").textContent = t.gps_error + (e && e.message ? ": " + e.message : ""); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    this.render();
  },
  stop() {
    if (this.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null; this.running = false;
    clearInterval(this.timer); this.timer = null;
    $("gpsBtn").textContent = t.gps_start;
    $("rideGpsState").textContent = t.gps_off;
    this.render();
  },
  onPos(pos) {
    const c = pos.coords, tms = pos.timestamp || Date.now();
    let inst = null;
    if (this.lastPos) {
      const dt = (tms - this.lastPos.t) / 1000;
      if (dt > 0) {
        const d = haversine(this.lastPos, { lat: c.latitude, lon: c.longitude });
        if (dt <= 10 && d <= 300) {           // reject teleports / stale fixes
          inst = (d / dt) * 3.6;
          if (inst > 1.5) this.tripM += d;     // only accumulate while moving
        }
      }
    }
    // The device's own doppler speed is preferred when present.
    if (c.speed != null && isFinite(c.speed) && c.speed >= 0) inst = c.speed * 3.6;
    if (inst == null) inst = this.speedKmh;
    this.speedKmh = this.speedKmh * 0.4 + inst * 0.6;  // EMA smoothing
    if (this.speedKmh < 1) this.speedKmh = 0;
    if (this.speedKmh > this.maxKmh) this.maxKmh = this.speedKmh;
    if (this.speedKmh > 0) { this.sumKmh += this.speedKmh; this.samples++; }
    this.lastPos = { lat: c.latitude, lon: c.longitude, t: tms };
    $("rideGpsState").textContent = t.gps_tracking + (c.accuracy ? "  ±" + Math.round(c.accuracy) + " m" : "");
    this.render();
  },
  render() {
    const U = UNITS[unit];
    $("rideSpeed").textContent = String(Math.round(this.speedKmh * U.speed));
    $("rideTrip").textContent = (this.tripM * U.dist).toFixed(U.distDec);
    $("rideMax").textContent = String(Math.round(this.maxKmh * U.speed));
    $("rideAvg").textContent = this.samples ? String(Math.round((this.sumKmh / this.samples) * U.speed)) : "0";
    $("rideTime").textContent = fmtTime(this.running ? (Date.now() - this.startedAt) / 1000 : 0);
    checkSpeedWarn();
  },
};
$("gpsBtn").onclick = () => (Geo.running ? Geo.stop() : Geo.start());

// Scooter read-outs on the Ride screen. dp ids are the ones this scooter
// reports; scale is decoded from the value (voltage /100, temp /10). dp 3 is a
// best guess for battery percentage until the DP spec confirms it.
const RIDE_CARDS = [
  { id: 3, label: () => t.batt, scale: 0, unit: "%" },
  { id: 20, label: () => t.volt, scale: 2, unit: "V" },
  { id: 18, label: () => t.temp, scale: 1, unit: "°C" },
];
const rideCards = new Map();
function buildRideCards() {
  const host = $("rideCards");
  host.textContent = "";
  rideCards.clear();
  for (const c of RIDE_CARDS) {
    const tile = document.createElement("div"); tile.className = "tile";
    const lab = document.createElement("div"); lab.className = "tile-label"; lab.textContent = c.label();
    const val = document.createElement("div"); val.className = "tile-value"; val.textContent = "–";
    tile.appendChild(lab); tile.appendChild(val);
    host.appendChild(tile);
    rideCards.set(c.id, { el: val, scale: c.scale, unit: c.unit });
  }
}
function updateRideCard(id, v) {
  const e = rideCards.get(id);
  if (!e || typeof v !== "number") return;
  const num = v / Math.pow(10, e.scale);
  e.el.textContent = (e.scale ? num.toFixed(e.scale) : num) + (e.unit ? " " + e.unit : "");
}

// Ride mode (Walk / Eco / D / S). DP 15 is the gear-selector candidate; its
// value may be a number or a Tuya ENUM string. The selector writes dp 15
// (through the usual arm + confirmation gate).
const GEAR_DP = 15;
let gearType = null; // the DP type the scooter actually reports for dp 15
const MODE_BTNS = [
  { key: "walk", id: "modeWalk", value: 0 },
  { key: "eco", id: "modeEco", value: 1 },
  { key: "d", id: "modeD", value: 2 },
  { key: "s", id: "modeS", value: 3 },
];
const MODE_ICONS = { walk: "🚶", eco: "🍃", d: "🛴", s: "⚡" };
const MODE_LABELS = { walk: () => t.mode_walk, eco: () => t.mode_eco, d: () => t.mode_d, s: () => t.mode_s };
const GEAR_ALIASES = {
  "0": "walk", walk: "walk", pedestrian: "walk",
  "1": "eco", eco: "eco", economy: "eco",
  "2": "d", d: "d", drive: "d", normal: "d",
  "3": "s", s: "s", sport: "s", turbo: "s",
};
let currentGear = null;

function buildModeButtons() {
  for (const b of MODE_BTNS) {
    const btn = $(b.id);
    btn.textContent = "";
    const ic = document.createElement("span");
    ic.className = "mode-emoji";
    ic.textContent = MODE_ICONS[b.key];
    const tx = document.createElement("span");
    tx.textContent = MODE_LABELS[b.key]();
    btn.appendChild(ic);
    btn.appendChild(tx);
    btn.classList.toggle("is-active", b.key === currentGear);
    btn.onclick = () => onModeClick(b);
  }
}
function onModeClick(b) {
  if (!tuya) { toast(t.status_disconnected); return; }
  if (!armed) { toast(t.arm_needed); return; }
  requestSend(GEAR_DP, gearType || DT.ENUM, b.value, MODE_ICONS[b.key] + " " + MODE_LABELS[b.key](), null);
}
function updateGear(id, v, type) {
  if (id !== GEAR_DP) return;
  if (type != null) gearType = type;
  if (v == null) return;
  const vk = String(v).toLowerCase();
  currentGear = GEAR_ALIASES[vk] || GEAR_ALIASES[String(Number(v))] || null;
  for (const b of MODE_BTNS) $(b.id).classList.toggle("is-active", b.key === currentGear);
}

// ---- voice speed announcements (Web Speech API) ----
const LS_TTS = "escooter.tts";
const ttsToggle = $("ttsToggle"), ttsEvery = $("ttsEvery"), ttsMax = $("ttsMax");
try {
  const s = JSON.parse(localStorage.getItem(LS_TTS) || "{}");
  if (s.every) ttsEvery.value = s.every;
  if (s.max !== undefined) ttsMax.value = s.max;
} catch (_) {}
function saveTts() {
  localStorage.setItem(LS_TTS, JSON.stringify({
    every: Math.max(5, Number(ttsEvery.value) || 30),
    max: Math.max(0, Number(ttsMax.value) || 0),
  }));
}
ttsEvery.addEventListener("change", saveTts);
ttsMax.addEventListener("change", saveTts);

// ---- speech-voice selection ----
const LS_VOICE = "escooter.voice";
const voiceSelect = $("voiceSelect");
function populateVoices() {
  if (!("speechSynthesis" in window) || !voiceSelect) return;
  const voices = window.speechSynthesis.getVoices() || [];
  const saved = localStorage.getItem(LS_VOICE) || "";
  voiceSelect.textContent = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = t.voice_default;
  voiceSelect.appendChild(def);
  const sorted = [...voices].sort((a, b) => {
    const pa = (a.lang || "").toLowerCase().startsWith(lang) ? 0 : 1;
    const pb = (b.lang || "").toLowerCase().startsWith(lang) ? 0 : 1;
    return pa - pb || (a.name || "").localeCompare(b.name || "");
  });
  for (const v of sorted) {
    const o = document.createElement("option");
    o.value = v.voiceURI || v.name;
    o.textContent = v.name + " (" + v.lang + ")";
    voiceSelect.appendChild(o);
  }
  const has = [...voiceSelect.children].some(c => c.value === saved);
  voiceSelect.value = saved && has ? saved : "";
}
function selectedVoice() {
  if (!("speechSynthesis" in window) || !voiceSelect || !voiceSelect.value) return null;
  const uri = voiceSelect.value;
  return (window.speechSynthesis.getVoices() || []).find(v => (v.voiceURI || v.name) === uri) || null;
}
voiceSelect.addEventListener("change", () => {
  localStorage.setItem(LS_VOICE, voiceSelect.value);
  // The chosen voice also selects the announcement language, so the spoken
  // words match the voice instead of being read by a mismatched engine.
  const v = selectedVoice();
  const base = v ? String(v.lang || "").toLowerCase().split("-")[0] : "";
  if (base && i18n[base] && base !== lang) setLang(base);
  else populateVoices();
});
if ("speechSynthesis" in window) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

const Announce = {
  on: false, count: 0, timer: null,
  start() {
    if (!("speechSynthesis" in window)) { log(t.tts_unavailable); ttsToggle.checked = false; updateTtsState(); return; }
    this.on = true; this.count = 0;
    this.tick();
  },
  tick() {
    if (!this.on) return;
    const max = Math.max(0, Number(ttsMax.value) || 0);
    if (max > 0 && this.count >= max) { this.stop(false); return; }
    this.speak();
    const every = Math.max(5, Number(ttsEvery.value) || 30);
    this.timer = setTimeout(() => this.tick(), every * 1000);
    updateTtsState();
  },
  speak() {
    this.count++;
    const U = UNITS[unit];
    const v = Math.round(Geo.speedKmh * U.speed);
    const text = v + " " + U.speedLabel;   // keep it as short as possible
    log("tts " + this.count + ": " + text);
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = selectedVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      window.speechSynthesis.speak(u);
    } catch (e) { log("tts error: " + e.message); }
  },
  stop(flipToggle) {
    this.on = false;
    clearTimeout(this.timer); this.timer = null;
    if (flipToggle !== false) ttsToggle.checked = false;
    updateTtsState();
  },
};
function updateTtsState() {
  if (!Announce.on) { $("ttsState").textContent = t.tts_off; return; }
  const every = Math.max(5, Number(ttsEvery.value) || 30);
  const max = Math.max(0, Number(ttsMax.value) || 0);
  $("ttsState").textContent = t.tts_on(every, max) + " · " + Announce.count + (max > 0 ? "/" + max : "");
}
ttsToggle.addEventListener("change", () => {
  if (ttsToggle.checked) Announce.start(); else Announce.stop(false);
  saveTts();
});

// -------------------------
// 8c. View switching
// -------------------------
function showView(name) {
  const ride = name === "ride";
  $("view-ride").hidden = !ride;
  $("view-debug").hidden = ride;
  $("tabRide").classList.toggle("is-active", ride);
  $("tabDebug").classList.toggle("is-active", !ride);
}
$("tabRide").onclick = () => showView("ride");
$("tabDebug").onclick = () => showView("debug");

// -------------------------
// 8d. Language switching
// -------------------------
function setLang(l) {
  if (!i18n[l] || l === lang) return;
  lang = l;
  t = i18n[l];
  localStorage.setItem(LS_LANG, l);
  applyStatic();
  buildControls(deviceSpec);
  buildRideCards();
  buildModeButtons();
  updateTtsState();
  if (Geo.running) {
    $("gpsBtn").textContent = t.gps_stop;
  } else {
    $("gpsBtn").textContent = t.gps_start;
    $("rideGpsState").textContent = t.gps_off;
  }
  Geo.render();
  setConnected(!!tuya);
  populateVoices();
  updateWarnUi();
  log("language: " + l);
}
$("langSelect").addEventListener("change", () => setLang($("langSelect").value));

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
    buildControls(deviceSpec);
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
        buildControls(deviceSpec); // enable the arm-switch / manual sender now we're connected
      },
    });
    tuya.allowWrites = armed; // hard guard in the library mirrors the UI arm-switch

    device.addEventListener("gattserverdisconnected", () => {
      setStatus(t.status_disconnected, "");
      setConnected(false);
      tuya = null;
      buildControls(deviceSpec);
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
  log("app v" + APP_VERSION);
  const ok = await Crypto.load();
  restoreDevices();
  buildControls(deviceSpec);
  buildRideCards();
  buildModeButtons();
  setUnit(unit);
  populateVoices();
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
