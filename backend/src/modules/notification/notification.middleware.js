import { notify } from './notification.service.js';
import { EVENTS, VERBS } from './notification.events.js';
import { scheduleStockCheck } from './notification.stock.js';

const REF_FIELDS = ['billNo', 'docNo', 'docNum', 'invoiceNo', 'receiptNo', 'number', 'code', 'name', 'title'];

function refOf(payload) {
  const data = payload?.data ?? payload;
  if (!data || typeof data !== 'object') return '';
  for (const f of REF_FIELDS) {
    if (data[f] !== undefined && data[f] !== null && data[f] !== '') return String(data[f]);
  }
  return '';
}

/**
 * Mount right after authorize(...) in app.js:
 *   app.use('/api/stock-receipts', authorize(...), notifyOnWrite('stock-receipt'), router);
 * After a successful (2xx) POST / PUT / PATCH / DELETE it records a
 * notification (pushed live over WebSocket) and, for stock-affecting
 * modules, re-checks low-stock levels. Reads and failures are ignored, and
 * nothing here can affect the response — it all runs after it was sent.
 */
export function notifyOnWrite(key) {
  const spec = EVENTS[key];
  return (req, res, next) => {
    if (!spec || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    let payload;
    const json = res.json.bind(res);
    res.json = (body) => { payload = body; return json(body); };

    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || !req.user?.tenantId) return;
      try {
        const sub = req.path.split('/').filter(Boolean);
        const last = sub[sub.length - 1];
        let verb;
        if (req.method === 'DELETE') verb = 'deleted';
        else if (req.method === 'POST' && sub.length === 0) verb = 'created';
        else if (VERBS[last]) verb = VERBS[last];
        else verb = req.method === 'POST' ? 'created' : 'updated';

        const ref = refOf(payload);
        const actor = req.user.name || req.user.username || 'A user';
        const isSale = key === 'line-sale' && verb === 'created';
        notify({
          tenantId: req.user.tenantId,
          type: `${key}.${verb}`,
          category: spec.category,
          severity: verb === 'deleted' ? 'warning' : (spec.severity && verb === 'created' ? spec.severity : 'success'),
          title: isSale ? 'New sale completed' : `${spec.label} ${verb}`,
          message: `${ref ? `${ref} · ` : ''}by ${actor}`,
          createdBy: req.user.id,
        });
        if (spec.stock) scheduleStockCheck(req.user.tenantId);
      } catch (err) {
        console.error('[notifications] hook failed:', err.message);
      }
    });
    return next();
  };
}
