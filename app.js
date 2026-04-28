'use strict';

// ── State ──────────────────────────────────────────────────────
const state = {
  currentType: 'url',
  logoDataURL: null,
  logoSize: 20,
  savedEcLevel: null,
  currentPNG: null,
  currentSVGRaw: null,
  lastText: '',
  lastSize: 300,
  lastFg: '#000000',
  lastBg: '#ffffff',
  lastEc: 'M',
  batchItems: [],
};

// ── DOM helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Theme ──────────────────────────────────────────────────────
const html = document.documentElement;
$('themeToggle').addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('qrcg-theme', next);
});
html.setAttribute('data-theme', localStorage.getItem('qrcg-theme') || 'light');

// ── Tab Navigation ─────────────────────────────────────────────
$$('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $$('.nav-tab').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${tab}`).classList.add('active');
    if (tab === 'history') renderHistory();
  });
});

// ── Toast ──────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Type selector ──────────────────────────────────────────────
const TYPE_LABELS = {
  url: 'URL', text: 'TEXTE LIBRE', email: 'EMAIL',
  phone: 'TÉLÉPHONE', wifi: 'WIFI', sms: 'SMS',
  vcard: 'CONTACT / vCARD', file: 'FICHIER',
};

$$('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    $$('.type-btn').forEach(b => b.classList.remove('active'));
    $$('.content-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    $(`form-${type}`).classList.add('active');
    $('contentLabel').textContent = TYPE_LABELS[type] || 'CONTENU';
    state.currentType = type;
    scheduleQR();
  });
});

// ── Content builders ───────────────────────────────────────────
function buildQRContent() {
  switch (state.currentType) {
    case 'url': return $('urlInput').value.trim();
    case 'text': return $('textInput').value.trim();
    case 'email': {
      const addr = $('emailAddress').value.trim();
      if (!addr) return '';
      const subj = $('emailSubject').value.trim();
      const body = $('emailBody').value.trim();
      let s = `mailto:${addr}`;
      const p = [];
      if (subj) p.push(`subject=${encodeURIComponent(subj)}`);
      if (body) p.push(`body=${encodeURIComponent(body)}`);
      if (p.length) s += '?' + p.join('&');
      return s;
    }
    case 'phone': {
      const cc = $('phoneCountry').value;
      const num = $('phoneNumber').value.trim().replace(/\s/g, '');
      if (!num) return '';
      const clean = num.startsWith('0') ? num.slice(1) : num;
      return `tel:${cc}${clean}`;
    }
    case 'wifi': {
      const ssid = $('wifiSSID').value.trim();
      if (!ssid) return '';
      const pw     = $('wifiPassword').value;
      const enc    = document.querySelector('input[name="wifiEnc"]:checked')?.value || 'WPA';
      const hidden = $('wifiHidden').checked ? 'true' : 'false';
      if (enc === 'nopass') return `WIFI:T:nopass;S:${ssid};;H:${hidden};`;
      return `WIFI:T:${enc};S:${ssid};P:${pw};;H:${hidden};`;
    }
    case 'sms': {
      const cc  = $('smsCountry').value;
      const num = $('smsNumber').value.trim().replace(/\s/g, '');
      if (!num) return '';
      const clean = num.startsWith('0') ? num.slice(1) : num;
      const msg = $('smsMessage').value.trim();
      return msg ? `sms:${cc}${clean}?body=${encodeURIComponent(msg)}` : `sms:${cc}${clean}`;
    }
    case 'vcard': {
      const first = $('vcardFirst').value.trim();
      const last  = $('vcardLast').value.trim();
      if (!first && !last) return '';
      // Use only filled fields to keep size minimal
      const org   = $('vcardOrg').value.trim();
      const title = $('vcardTitle').value.trim();
      const phone = $('vcardPhone').value.trim();
      const email = $('vcardEmail').value.trim();
      const url   = $('vcardUrl').value.trim();
      const addr  = $('vcardAddress').value.trim();
      let v = `BEGIN:VCARD\nVERSION:3.0\n`;
      v += `N:${last};${first};;;\n`;
      v += `FN:${first}${last ? ' ' + last : ''}\n`;
      if (org)   v += `ORG:${org}\n`;
      if (title) v += `TITLE:${title}\n`;
      if (phone) v += `TEL:${phone}\n`;
      if (email) v += `EMAIL:${email}\n`;
      if (url)   v += `URL:${url}\n`;
      if (addr)  v += `ADR:;;${addr};;;;\n`;
      v += `END:VCARD`;
      // Auto-switch to L correction for max capacity
      if (!state.savedEcLevel) {
        state.savedVcardEc = $('ecLevel').value;
        $('ecLevel').value = 'L';
      }
      return v;
    }
    case 'file': return ($('fileUrlInput') && $('fileUrlInput').value.trim()) || '';
    default: return '';
  }
}

// ── Input listeners ────────────────────────────────────────────
const ALL_INPUTS = [
  'urlInput','textInput','emailAddress','emailSubject','emailBody',
  'phoneCountry','phoneNumber','wifiSSID','wifiPassword','wifiHidden',
  'smsCountry','smsNumber','smsMessage',
  'vcardFirst','vcardLast','vcardOrg','vcardTitle','vcardPhone','vcardEmail','vcardUrl','vcardAddress',
  'fileUrlInput',
  'qrSize','ecLevel','fgColor','bgColor',
];
ALL_INPUTS.forEach(id => {
  const el = $(id);
  if (el) { el.addEventListener('input', scheduleQR); el.addEventListener('change', scheduleQR); }
});
$$('input[name="wifiEnc"]').forEach(r => r.addEventListener('change', scheduleQR));

$('fgColor').addEventListener('input', e => { $('fgColorVal').textContent = e.target.value; });
$('bgColor').addEventListener('input', e => { $('bgColorVal').textContent = e.target.value; });

$('toggleWifiPw').addEventListener('click', () => {
  const pw = $('wifiPassword');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

// ── Corner style picker ────────────────────────────────────────
// ── Preset logos — render SVG to PNG then inject buttons ────────
const LOGOS = [
  { key: 'facebook',  label: 'Facebook',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#1877F2"/><path fill="white" d="M67 100V61h13l2-16H67v-9c0-5 1-8 8-8h7V13c-1 0-5-1-11-1-11 0-19 7-19 20v11H39v16h13v39z"/></svg>` },
  { key: 'instagram', label: 'Instagram', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="ig3" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="25%" stop-color="#e6683c"/><stop offset="50%" stop-color="#dc2743"/><stop offset="75%" stop-color="#cc2366"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#ig3)"/><rect x="20" y="20" width="60" height="60" rx="16" fill="none" stroke="white" stroke-width="6"/><circle cx="50" cy="50" r="16" fill="none" stroke="white" stroke-width="6"/><circle cx="73" cy="27" r="5" fill="white"/></svg>` },
  { key: 'whatsapp',  label: 'WhatsApp',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#25D366"/><path fill="white" d="M50 15C30 15 14 31 14 51c0 7 2 13 6 18L14 86l18-6c5 3 11 5 18 5 20 0 36-16 36-36S70 15 50 15zm21 50c-1 2-4 4-6 4-1 0-4 0-13-4-8-4-13-11-14-12-1-1-5-7-5-13s3-9 4-10c1-2 3-2 4-2h2c1 0 2 0 3 3l4 9c0 1 0 2-1 3l-2 2c-1 1-1 2 0 3 1 2 5 7 9 10 4 2 7 3 8 4 1 0 2 0 3-1l2-3c1-1 2-1 3-1l8 4c1 1 2 1 2 3 0 1-1 4-2 5z"/></svg>` },
  { key: 'youtube',   label: 'YouTube',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#FF0000"/><path fill="white" d="M82 35s-1-6-4-8c-3-4-7-4-9-4C58 22 50 22 50 22s-8 0-19 1c-2 0-6 1-9 4-3 2-4 8-4 8S17 41 17 48v6c0 7 1 13 1 13s1 6 4 8c3 4 8 3 10 4C39 80 50 80 50 80s8 0 19-2c2 0 6-1 9-4 3-2 4-8 4-8s1-6 1-13v-6c0-7-1-13-1-13zM42 62V38l24 12-24 12z"/></svg>` },
  { key: 'tiktok',    label: 'TikTok',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#010101"/><path fill="#69C9D0" d="M72 25c-5-1-9-4-12-8h-9v48c0 5-4 9-9 9s-9-4-9-9 4-9 9-9c1 0 2 0 3 1V48c-1 0-2 0-3 0-10 0-18 8-18 18s8 18 18 18 18-8 18-18V41c4 3 8 4 12 5V37c-2 0-7-2-10-6l10-6z"/><path fill="white" d="M62 35c3 4 7 7 12 8v9c-4-1-8-2-12-5v26c0 10-8 18-18 18s-18-8-18-18 8-18 18-18c1 0 2 0 3 0v9c-1 0-2-1-3-1-5 0-9 4-9 9s4 9 9 9 9-4 9-9V17h9c3 4 7 7 12 8"/></svg>` },
  { key: 'linkedin',  label: 'LinkedIn',  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="#0A66C2"/><path fill="white" d="M25 38h15v47H25zm7-5a9 9 0 110-18 9 9 0 010 18zm55 52H72V62c0-4-1-9-7-9s-8 4-8 8v24H42V38h14v6c2-3 6-7 13-7 14 0 18 9 18 21z"/></svg>` },
  { key: 'scan-me',  label: 'Scan Me',   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="12" fill="#111"/><rect x="10" y="10" width="28" height="28" rx="4" fill="none" stroke="#f5e642" stroke-width="4"/><rect x="17" y="17" width="14" height="14" fill="#f5e642"/><rect x="62" y="10" width="28" height="28" rx="4" fill="none" stroke="#f5e642" stroke-width="4"/><rect x="69" y="17" width="14" height="14" fill="#f5e642"/><rect x="10" y="62" width="28" height="28" rx="4" fill="none" stroke="#f5e642" stroke-width="4"/><rect x="17" y="69" width="14" height="14" fill="#f5e642"/><rect x="62" y="62" width="8" height="8" fill="#f5e642"/><rect x="75" y="62" width="8" height="8" fill="#f5e642"/><rect x="62" y="75" width="8" height="8" fill="#f5e642"/><rect x="75" y="75" width="8" height="8" fill="#f5e642"/><rect x="10" y="42" width="80" height="4" fill="#f5e642" opacity=".4"/><text x="50" y="97" text-anchor="middle" fill="#f5e642" font-family="Arial" font-size="9" font-weight="bold">SCAN ME</text></svg>` },
  { key: 'camera',   label: 'Caméra',    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#555"/><path fill="white" d="M80 35H67l-6-9H39l-6 9H20c-4 0-8 4-8 8v35c0 4 4 8 8 8h60c4 0 8-4 8-8V43c0-4-4-8-8-8zM50 76a18 18 0 110-36 18 18 0 010 36zm0-8a10 10 0 100-20 10 10 0 000 20z"/></svg>` },
  { key: 'custom',   label: 'Mon logo',  svg: null },
];

// Render SVG to PNG via blob URL + canvas
function svgToPng(svgStr, size = 100) {
  return new Promise(resolve => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Build preset logo buttons with rendered PNG thumbnails
async function initPresetLogos() {
  const grid = $('presetLogosGrid');
  for (const logo of LOGOS) {
    const btn = document.createElement('button');
    btn.className = 'preset-logo-btn';
    btn.dataset.logo = logo.key;
    btn.title = logo.label;

    if (logo.svg) {
      const pngUrl = await svgToPng(logo.svg, 100);
      const imgEl = document.createElement('img');
      imgEl.src = pngUrl || '';
      imgEl.width = 32; imgEl.height = 32;
      imgEl.alt = `Logo ${logo.label}`;
      imgEl.style.borderRadius = '4px';
      btn.appendChild(imgEl);
      // Cache PNG for canvas use
      btn.dataset.pngUrl = pngUrl || '';
    } else {
      const sp = document.createElement('span');
      sp.style.fontSize = '22px';
      sp.textContent = '⊕';
      btn.appendChild(sp);
    }

    const label = document.createElement('span');
    label.textContent = logo.label;
    btn.appendChild(label);

    btn.addEventListener('click', async () => {
      if (logo.key === 'custom') { $('logoFile').click(); return; }
      $$('.preset-logo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pngUrl = btn.dataset.pngUrl;
      if (!pngUrl) return;
      state.logoDataURL = pngUrl;
      $('logoPreviewImg').src = pngUrl;
      $('dropContent').style.display = 'none';
      $('logoPreviewWrap').style.display = 'flex';
      if (!state.savedEcLevel) { state.savedEcLevel = $('ecLevel').value; $('ecLevel').value = 'H'; }
      showToast('✓ Logo sélectionné — correction H activée');
      scheduleQR();
    });

    grid.appendChild(btn);
  }
}

initPresetLogos();

// ── Custom logo upload ─────────────────────────────────────────
const logoDropZone = $('logoDropZone');
const logoFile     = $('logoFile');

$('logoPickBtn').addEventListener('click', e => { e.stopPropagation(); logoFile.click(); });
logoDropZone.addEventListener('click', () => { if (!state.logoDataURL) logoFile.click(); });
logoDropZone.addEventListener('dragover', e => { e.preventDefault(); logoDropZone.classList.add('drag-over'); });
logoDropZone.addEventListener('dragleave', () => logoDropZone.classList.remove('drag-over'));
logoDropZone.addEventListener('drop', e => {
  e.preventDefault(); logoDropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadLogo(f);
});
logoFile.addEventListener('change', e => { if (e.target.files[0]) loadLogo(e.target.files[0]); });

function loadLogo(file) {
  const reader = new FileReader();
  reader.onload = evt => {
    state.logoDataURL = evt.target.result;
    $('logoPreviewImg').src = state.logoDataURL;
    $('dropContent').style.display = 'none';
    $('logoPreviewWrap').style.display = 'flex';
    $$('.preset-logo-btn').forEach(b => b.classList.remove('active'));
    state.savedEcLevel = $('ecLevel').value;
    $('ecLevel').value = 'H';
    showToast('✓ Logo ajouté — correction H activée');
    scheduleQR();
  };
  reader.readAsDataURL(file);
}

$('removeLogo').addEventListener('click', e => {
  e.stopPropagation();
  state.logoDataURL = null;
  logoFile.value = '';
  $('dropContent').style.display = 'flex';
  $('logoPreviewWrap').style.display = 'none';
  $$('.preset-logo-btn').forEach(b => b.classList.remove('active'));
  if (state.savedEcLevel) { $('ecLevel').value = state.savedEcLevel; state.savedEcLevel = null; }
  scheduleQR();
});

$('logoSize').addEventListener('input', e => {
  state.logoSize = parseInt(e.target.value);
  $('logoSizeVal').textContent = state.logoSize;
  scheduleQR();
});

// ── QR Generation ──────────────────────────────────────────────
let qrTimer;
function scheduleQR() {
  clearTimeout(qrTimer);
  qrTimer = setTimeout(generateQR, 120);
}

async function generateQR() {
  let text = buildQRContent();
  const size  = parseInt($('qrSize').value) || 300;
  const ec    = $('ecLevel').value;
  const fg    = $('fgColor').value;
  const bg    = $('bgColor').value;

  const output      = $('qrOutput');
  const placeholder = $('qrPlaceholder');
  const meta        = $('qrMeta');

  if (!text) {
    output.innerHTML = '';
    placeholder.style.display = 'flex';
    meta.style.display = 'none';
    setExportEnabled(false);
    return;
  }

  // QRCode.js uses Latin-1 byte mode — accented chars cause "code length overflow".
  // Normalize accents to ASCII equivalents before encoding.
  const safeText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  placeholder.style.display = 'none';
  output.innerHTML = '';

  try {
    // Generate base QR via library (hidden)
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
    document.body.appendChild(tempDiv);

    await new Promise(resolve => {
      new QRCode(tempDiv, {
        text: safeText, width: size, height: size,
        colorDark: fg, colorLight: bg,
        correctLevel: QRCode.CorrectLevel[ec],
      });
      setTimeout(resolve, 50);
    });

    const srcCanvas = tempDiv.querySelector('canvas');
    if (!srcCanvas) { document.body.removeChild(tempDiv); throw new Error('No canvas'); }

    // Clone src canvas before removing tempDiv
    const cloned = document.createElement('canvas');
    cloned.width = srcCanvas.width; cloned.height = srcCanvas.height;
    cloned.getContext('2d').drawImage(srcCanvas, 0, 0);
    document.body.removeChild(tempDiv);

    // Composite logo if set
    let finalCanvas = state.logoDataURL
      ? await compositeWithLogo(cloned, state.logoDataURL, state.logoSize)
      : cloned;

    // Display
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width  = finalCanvas.width;
    displayCanvas.height = finalCanvas.height;
    displayCanvas.getContext('2d').drawImage(finalCanvas, 0, 0);
    output.appendChild(displayCanvas);

    // Cache
    state.currentPNG    = finalCanvas.toDataURL('image/png');
    state.currentSVGRaw = buildSVG(finalCanvas, fg, bg, safeText, size);
    state.lastText = safeText; state.lastSize = size;
    state.lastFg = fg; state.lastBg = bg; state.lastEc = ec;

    $('metaChars').textContent = `${text.length} car.`;
    $('metaSize').textContent  = `${size}×${size}px`;
    $('metaLevel').textContent = `EC: ${ec}`;
    meta.style.display = 'flex';
    setExportEnabled(true);

  } catch(err) {
    output.innerHTML = `<div style="color:var(--danger);font-family:var(--font-mono);font-size:12px;padding:20px;text-align:center;">Erreur : ${err.message}</div>`;
    setExportEnabled(false);
  }
}

// ── roundRect helper (used for logo background) ────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function compositeWithLogo(srcCanvas, logoURL, logoPercent) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = srcCanvas.width; canvas.height = srcCanvas.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(srcCanvas, 0, 0);

      const logoW = Math.round(srcCanvas.width * logoPercent / 100);
      const logoH = Math.round(logoW * img.naturalHeight / img.naturalWidth);
      const x = (canvas.width  - logoW) / 2;
      const y = (canvas.height - logoH) / 2;
      const pad = Math.round(logoW * 0.12);
      const r   = pad * 1.5;

      // White circular/rounded background using our own roundRect helper
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      roundRect(ctx, x - pad, y - pad, logoW + pad * 2, logoH + pad * 2, r);
      ctx.fill();

      ctx.drawImage(img, x, y, logoW, logoH);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = logoURL;
  });
}

function buildSVG(canvas, fg, bg, text, size) {
  const dataURL = canvas.toDataURL('image/png');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/><image href="${dataURL}" width="${size}" height="${size}"/></svg>`;
}

function setExportEnabled(enabled) {
  ['dlPNG','dlSVG','dlPDF','saveHistory'].forEach(id => { $(id).disabled = !enabled; });
}

// ── Downloads ──────────────────────────────────────────────────
$('dlPNG').addEventListener('click', () => {
  if (!state.currentPNG) return;
  downloadURL(state.currentPNG, `qrcg-${slugify(state.lastText)}.png`);
  showToast('✓ PNG téléchargé');
});

$('dlSVG').addEventListener('click', () => {
  if (!state.currentSVGRaw) return;
  const blob = new Blob([state.currentSVGRaw], { type: 'image/svg+xml' });
  downloadURL(URL.createObjectURL(blob), `qrcg-${slugify(state.lastText)}.svg`);
  showToast('✓ SVG téléchargé');
});

$('dlPDF').addEventListener('click', async () => {
  if (!state.currentPNG) return;
  try {
    const { jsPDF } = window.jspdf;
    const mmSize = Math.min(state.lastSize / 3.7795, 180);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const x = (pageW - mmSize) / 2;
    const y = (pageH - mmSize) / 2 - 15;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('qrcodegenerator.fr', pageW / 2, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(($('qrLabel').value || state.lastText).substring(0, 80), pageW / 2, 27, { align: 'center' });
    doc.addImage(state.currentPNG, 'PNG', x, y, mmSize, mmSize);
    doc.setFontSize(8); doc.setTextColor(160);
    doc.text('qrcodegenerator.fr', pageW / 2, pageH - 12, { align: 'center' });
    doc.save(`qrcg-${slugify(state.lastText)}.pdf`);
    showToast('✓ PDF téléchargé');
  } catch(e) { showToast('⚠ Erreur PDF'); }
});

// ── History ────────────────────────────────────────────────────
const HISTORY_KEY = 'qrcg-history';
function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }

$('saveHistory').addEventListener('click', () => {
  if (!state.currentPNG) return;
  const label = $('qrLabel').value || state.lastText;
  const hist  = getHistory();
  hist.unshift({ id: Date.now(), label, content: state.lastText, png: state.currentPNG,
    date: new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
    fg: state.lastFg, bg: state.lastBg });
  if (hist.length > 50) hist.length = 50;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  showToast('✓ Sauvegardé dans l\'historique');
});

function renderHistory() {
  const hist  = getHistory();
  const grid  = $('historyGrid');
  const empty = $('historyEmpty');
  $('historyCount').textContent = `${hist.length} entrée${hist.length !== 1 ? 's' : ''}`;
  if (!hist.length) { grid.innerHTML = ''; grid.appendChild(empty); return; }
  grid.innerHTML = '';
  hist.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.style.animationDelay = `${idx * 30}ms`;
    card.innerHTML = `
      <div class="history-card-img"><img src="${entry.png}" alt="${entry.label}" style="max-width:160px;max-height:160px;" /></div>
      <div class="history-card-body">
        <div class="history-card-label">${entry.label}</div>
        <div class="history-card-content">${entry.content.substring(0, 60)}</div>
        <div class="history-card-date">${entry.date}</div>
        <div class="history-card-actions">
          <button class="hist-action-btn" data-action="download" data-id="${entry.id}">↓ PNG</button>
          <button class="hist-action-btn" data-action="load" data-id="${entry.id}">↗ Charger</button>
          <button class="hist-action-btn" data-action="pdf" data-id="${entry.id}">↓ PDF</button>
          <button class="hist-action-btn delete" data-action="delete" data-id="${entry.id}">✕ Sup.</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const entry = getHistory().find(h => h.id === id);
    if (!entry) return;
    if (btn.dataset.action === 'download') { downloadURL(entry.png, `qrcg-${slugify(entry.content)}.png`); showToast('✓ PNG téléchargé'); }
    else if (btn.dataset.action === 'load') {
      $$('.nav-tab')[0].click(); $$('.type-btn')[0].click();
      $('urlInput').value = entry.content; $('qrLabel').value = entry.label;
      $('fgColor').value = entry.fg || '#000000'; $('bgColor').value = entry.bg || '#ffffff';
      $('fgColorVal').textContent = entry.fg || '#000000'; $('bgColorVal').textContent = entry.bg || '#ffffff';
      scheduleQR(); showToast('↗ QR code chargé');
    }
    else if (btn.dataset.action === 'pdf') { exportHistoryPDF(entry); }
    else if (btn.dataset.action === 'delete') {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(h => h.id !== id)));
      renderHistory(); showToast('✓ Supprimé');
    }
  });
}

async function exportHistoryPDF(entry) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('qrcodegenerator.fr', pageW / 2, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(entry.label.substring(0, 80), pageW / 2, 27, { align: 'center' });
    doc.addImage(entry.png, 'PNG', (pageW - 100) / 2, 40, 100, 100);
    doc.setFontSize(8); doc.setTextColor(160);
    doc.text('qrcodegenerator.fr', pageW / 2, pageH - 12, { align: 'center' });
    doc.save(`qrcg-${slugify(entry.content)}.pdf`);
    showToast('✓ PDF téléchargé');
  } catch(e) { showToast('⚠ Erreur PDF'); }
}

$('clearHistory').addEventListener('click', () => {
  if (!confirm('Effacer tout l\'historique ?')) return;
  localStorage.removeItem(HISTORY_KEY); renderHistory(); showToast('✓ Historique effacé');
});

// ── Batch ──────────────────────────────────────────────────────
$('generateBatch').addEventListener('click', generateBatch);

async function generateBatch() {
  const raw = $('batchInput').value.trim();
  if (!raw) { showToast('⚠ Entrez au moins une ligne'); return; }
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10);
  const fg = $('batchFg').value, bg = $('batchBg').value;
  const size = parseInt($('batchSize').value) || 200;
  const grid = $('batchGrid');
  grid.innerHTML = ''; state.batchItems = [];
  $('batchCountNum').textContent = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const item = document.createElement('div');
    item.className = 'batch-item'; item.style.animationDelay = `${i * 60}ms`;
    const canvas = await generateBatchQR(text, size, fg, bg);
    const png = canvas.toDataURL('image/png');
    state.batchItems.push({ text, png, canvas });
    const label = document.createElement('div'); label.className = 'batch-item-label'; label.textContent = text;
    const dlBtn = document.createElement('button'); dlBtn.className = 'batch-dl-btn'; dlBtn.dataset.idx = i; dlBtn.textContent = '↓ PNG';
    item.appendChild(canvas); item.appendChild(label); item.appendChild(dlBtn); grid.appendChild(item);
  }

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.batch-dl-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    const item = state.batchItems[idx];
    if (item) { downloadURL(item.png, `qrcg-batch-${idx+1}.png`); showToast(`✓ QR #${idx+1} téléchargé`); }
  });
  showToast(`✓ ${lines.length} QR codes générés`);
}

function generateBatchQR(text, size, fg, bg) {
  return new Promise((resolve, reject) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
    document.body.appendChild(div);
    try {
      new QRCode(div, { text, width: size, height: size, colorDark: fg, colorLight: bg, correctLevel: QRCode.CorrectLevel.M });
      setTimeout(() => {
        const canvas = div.querySelector('canvas');
        if (!canvas) { document.body.removeChild(div); reject(new Error('No canvas')); return; }
        const out = document.createElement('canvas');
        out.width = canvas.width; out.height = canvas.height;
        out.getContext('2d').drawImage(canvas, 0, 0);
        document.body.removeChild(div); resolve(out);
      }, 60);
    } catch(e) { document.body.removeChild(div); reject(e); }
  });
}

$('downloadAllPNG').addEventListener('click', async () => {
  if (!state.batchItems.length) { showToast('⚠ Générez d\'abord'); return; }
  for (let i = 0; i < state.batchItems.length; i++) { await sleep(100); downloadURL(state.batchItems[i].png, `qrcg-batch-${i+1}.png`); }
  showToast(`✓ ${state.batchItems.length} PNG téléchargés`);
});

$('downloadBatchPDF').addEventListener('click', async () => {
  if (!state.batchItems.length) { showToast('⚠ Générez d\'abord'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
    const cols = 2, rows = 3, perPage = cols * rows, margin = 15;
    const cellW = (pageW - margin * 2) / cols, cellH = (pageH - margin * 2 - 20) / rows;
    const qrW = Math.min(cellW - 10, cellH - 14);
    state.batchItems.forEach((item, i) => {
      if (i > 0 && i % perPage === 0) doc.addPage();
      const col = i % cols, row = Math.floor((i % perPage) / cols);
      const x = margin + col * cellW + (cellW - qrW) / 2, y = margin + 10 + row * cellH + 5;
      if (i % perPage === 0) { doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(30); doc.text('qrcodegenerator.fr — Batch', pageW/2, 10, {align:'center'}); }
      doc.addImage(item.png, 'PNG', x, y, qrW, qrW);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100);
      doc.text(item.text.substring(0, 40), x + qrW/2, y + qrW + 4, {align:'center'});
    });
    doc.save('qrcg-batch.pdf'); showToast('✓ PDF batch téléchargé');
  } catch(e) { showToast('⚠ Erreur PDF'); }
});

// ── Utils ──────────────────────────────────────────────────────
function downloadURL(url, filename) { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); }
function slugify(str) { return (str||'qrcode').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,40)||'qrcode'; }
function formatBytes(b) { if (b < 1024) return b+' o'; if (b < 1048576) return (b/1024).toFixed(1)+' Ko'; return (b/1048576).toFixed(1)+' Mo'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Init ───────────────────────────────────────────────────────
renderHistory();