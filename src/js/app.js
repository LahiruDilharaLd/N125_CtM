const $ = s => document.querySelector(s);
const norm = s => String(s).trim().toUpperCase();
const DB = new Map();
let stream = null, raf = 0;

/* ---------- theme ---------- */
const THEMES = ["green", "amber", "blue", "red"];
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("n125-theme", t); } catch (e) {}
}
function cycleTheme() {
  const i = THEMES.indexOf(document.documentElement.dataset.theme || "green");
  setTheme(THEMES[(i + 1) % THEMES.length]);
}
try { setTheme(localStorage.getItem("n125-theme") || "green"); } catch (e) { setTheme("green"); }
$("#theme").onclick = cycleTheme;
addEventListener("keydown", e => {
  if ((e.key === "t" || e.key === "T") && !/INPUT/.test(document.activeElement.tagName)) cycleTheme();
});

/* ---------- login + encrypted data ---------- */
const CFG = { groupName: "Pulsar N125 Official Club" };
let current = null;
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decryptData(user, pass) {
  const enc = await (await fetch("src/data/data.enc.json", { cache: "no-store" })).json();
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(user.trim().toLowerCase() + ":" + pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(enc.salt), iterations: enc.iter, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(enc.iv) }, key, b64(enc.ct))));
}
function goFull() {
  const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
  try { if (f && !document.fullscreenElement) Promise.resolve(f.call(d)).catch(() => {}); } catch (e) {}
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  goFull();                                   // must run inside the click/submit gesture
  const lm = $("#lmsg"); lm.className = "msg"; lm.textContent = "> AUTHENTICATING...";
  try {
    const j = await decryptData($("#user").value, $("#pass").value);
    j.riders.forEach(x => DB.set(norm(x.id), x));
    Object.assign(CFG, j.config || {});
    $("#count").textContent = DB.size + " RECORDS"; $("#pass").value = "";
    startCamera();
  } catch (err) {
    lm.className = "msg err";
    lm.textContent = err.name === "OperationError" ? "> ACCESS DENIED. INVALID CREDENTIALS." : "> DATA FILE NOT LOADED (needs https).";
    const c = $("#loginView"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
  }
});
function lookup(raw) {
  const t = norm(raw);
  if (DB.has(t)) return DB.get(t);
  for (const [k, v] of DB) if (t.includes(k)) return v;   // QR may hold a URL containing the ID
  return null;
}

/* ---------- views ---------- */
function say(text, err) { const m = $("#msg"); m.textContent = text; m.className = "msg" + (err ? " err" : ""); }
function show(id) {
  ["loginView", "scanView", "okView", "badView"].forEach(v => $("#" + v).hidden = v !== id);
  $("#rescan").hidden = id === "scanView" || id === "loginView";
  $("#badge").textContent = { loginView: "LOCKED", scanView: "SCANNING", okView: "VERIFIED", badView: "DENIED" }[id];
}
function banner(text, cls) {
  const b = $("#banner"); b.textContent = text; b.className = cls; b.hidden = false;
  clearTimeout(banner.t); banner.t = setTimeout(() => b.hidden = true, 1800);
}
function handle(raw) {
  stopCamera();
  const r = lookup(raw);
  if (r) {
    $("#rName").textContent = r.name;
    $("#rBike").textContent = r.bike;
    $("#welcome").innerHTML = "&gt; Welcome to the <b>Pulsar N125 Official Club</b>, " + esc(r.name.split(" ")[0]) + "! Ride safe.";
    $("#rId").textContent = "ID: " + r.id;
    current = r; $("#waMsg").textContent = "";
    show("okView");
  } else {
    $("#badRaw").textContent = "READ: " + String(raw).slice(0, 80);
    show("badView"); banner("UNKNOWN ID", "alert");
  }
}
const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- camera ---------- */
async function startCamera() {
  show("scanView"); say("> INITIALISING CAMERA...");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const v = $("#video"); v.srcObject = stream; await v.play();
    say("> SCANNING FOR QR CODE...");
    raf = requestAnimationFrame(tick);
  } catch (e) {
    say("> CAMERA UNAVAILABLE. Allow access (HTTPS required) or enter the ID below.", true);
  }
}
function stopCamera() {
  cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; $("#video").srcObject = null;
}
function tick() {
  const v = $("#video");
  if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
    const c = $("#work"), s = Math.min(1, 720 / v.videoWidth);
    c.width = v.videoWidth * s; c.height = v.videoHeight * s;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(v, 0, 0, c.width, c.height);
    const img = x.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, c.width, c.height, { inversionAttempts: "attemptBoth" });
    if (code && code.data) return handle(code.data);
  }
  raf = requestAnimationFrame(tick);
}

/* ---------- wiring ---------- */
$("#rescan").onclick = () => { $("#manual").value = ""; startCamera(); };
$("#lookup").onclick = () => { const v = $("#manual").value; if (v.trim()) handle(v); };
$("#manual").addEventListener("keydown", e => { if (e.key === "Enter") $("#lookup").click(); });
$("#wa").onclick = () => {
  if (!current) return;
  if (!/^\d{11}$/.test(current.phone)) { $("#waMsg").textContent = "> INVALID MOBILE NUMBER: " + current.phone; return; }
  const lines = ["*Welcome to the Pulsar N125 Official Club, " + current.name + "!* 🏍️", "",
    "*Bike No:* " + current.bike, "*Reg ID:* " + current.id, ""];
  // join.html carries the group image + name as a WhatsApp preview card and forwards to the group
  lines.push("*Join our official WhatsApp group:* " + CFG.groupName + " 👇", new URL("join.html", location.href).href, "");
  lines.push("*Ride safe!*");
  if (window.self !== window.top) { $("#waMsg").textContent = "> WhatsApp is blocked inside a preview frame. Open this page in a normal browser tab or on your phone."; return; }
  window.open("https://wa.me/" + current.phone + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener");
};
show("loginView");
