/**
 * Silent ("direct") printing through QZ Tray (https://qz.io) - a small free
 * helper installed once on each counter PC. A website can never print without
 * the browser's print dialog on its own; QZ Tray runs locally and lets the
 * hosted app (Azure Static Web App) send the receipt straight to the printer.
 *
 * Everything here is best-effort: if QZ Tray is not installed/running, or
 * anything fails, printHtml() falls back to the normal browser print dialog,
 * so printing never stops working.
 *
 * Trust: when the backend has the signing key configured (QZ_PRIVATE_KEY_B64 /
 * QZ_CERTIFICATE_B64) every request is signed, and QZ Tray - given the matching
 * override.crt once - stops asking "Allow?". Without it QZ Tray prompts.
 *
 * Optional settings (per PC, in localStorage):
 *   nexora.qzPrinter     - printer name; default = the Windows default printer
 *   nexora.silentPrint   - set to "off" to always use the browser dialog
 *   nexora.receiptWidth  - paper width in mm (default 80)
 */
import { API_BASE_URL } from '../../api/baseApi';
import { loadPersistedAuth } from '../../features/auth/authStorage';

const QZ_SRC = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
const RETRY_AFTER_MS = 60_000; // after a failed attempt, don't retry for a minute

let loadPromise = null;
let lastFailureAt = 0;

const read = (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};

function loadQz() {
  if (window.qz) return Promise.resolve(window.qz);
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = QZ_SRC;
      el.async = true;
      el.onload = () => (window.qz ? resolve(window.qz) : reject(new Error('QZ not available')));
      el.onerror = () => reject(new Error('Could not load QZ Tray library'));
      document.head.appendChild(el);
    }).catch((err) => { loadPromise = null; throw err; });
  }
  return loadPromise;
}

const authHeaders = () => {
  const token = loadPersistedAuth()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function configureSigning(qz) {
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setCertificatePromise((resolve) => {
    fetch(`${API_BASE_URL}/print/certificate`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('no certificate'))))
      .then(resolve)
      // Not configured / offline: fall back to unsigned mode (QZ Tray prompts).
      .catch(() => resolve(''));
  });
  qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
    fetch(`${API_BASE_URL}/print/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ message: toSign }),
    })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('sign failed'))))
      .then(resolve)
      .catch(() => resolve(''));
  });
}

let signingReady = false;
async function connect(qz) {
  if (qz.websocket.isActive()) return;
  if (!signingReady) {
    await configureSigning(qz);
    signingReady = true;
  }
  await qz.websocket.connect({ retries: 0, delay: 0 });
}

/**
 * Prints a full HTML document silently. Resolves true when sent to the
 * printer, false when silent printing isn't available (caller falls back).
 */
export async function silentPrintHtml(html) {
  if (read('nexora.silentPrint') === 'off') return false;
  if (Date.now() - lastFailureAt < RETRY_AFTER_MS) return false;
  try {
    const qz = await loadQz();
    await connect(qz);
    const printer = read('nexora.qzPrinter') || await qz.printers.getDefault();
    const width = Number(read('nexora.receiptWidth')) || 80;
    const config = qz.configs.create(printer, {
      units: 'mm',
      size: { width },
      margins: 0,
      scaleContent: true,
      rasterize: true,
    });
    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    lastFailureAt = 0;
    return true;
  } catch {
    lastFailureAt = Date.now();
    return false;
  }
}
