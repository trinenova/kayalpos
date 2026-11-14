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
 * Optional settings (per PC, in localStorage):
 *   nexora.qzPrinter     - printer name; default = the Windows default printer
 *   nexora.silentPrint   - set to "off" to always use the browser dialog
 *   nexora.receiptWidth  - paper width in mm (default 80)
 */
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

async function connect(qz) {
  if (qz.websocket.isActive()) return;
  // Unsigned mode: QZ Tray asks the operator to "Allow" (tick "Remember this
  // decision" once and it never asks again on that PC).
  qz.security.setCertificatePromise((resolve) => resolve(''));
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(() => (resolve) => resolve());
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
