import crypto from 'node:crypto';
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/errorHandler.js';

/**
 * QZ Tray request signing, so the counter PCs' QZ Tray can trust Nexora and
 * stop asking "Allow?" on every print.
 *
 * QZ Tray needs (1) our public certificate and (2) each print request signed
 * with the matching private key. The private key must never reach the browser,
 * so signing happens here. Both come from environment variables (set them in
 * backend/.env locally and in the Azure Web App > Configuration > Application
 * settings), each base64-encoded so multi-line PEM survives env handling:
 *
 *   QZ_CERTIFICATE_B64   - base64 of the public certificate (PEM)
 *   QZ_PRIVATE_KEY_B64   - base64 of the private key (PEM)
 *
 * If they are not set the endpoints answer 503 and the frontend simply falls
 * back to unsigned mode (QZ Tray then prompts), so nothing breaks.
 */
const decode = (b64) => (b64 ? Buffer.from(b64, 'base64').toString('utf8') : '');

const router = Router();
router.use(requireAuth);

router.get('/certificate', (req, res, next) => {
  const cert = decode(process.env.QZ_CERTIFICATE_B64);
  if (!cert) return next(new ApiError(503, 'Silent printing certificate is not configured'));
  res.type('text/plain').send(cert);
});

router.post('/sign', (req, res, next) => {
  const key = decode(process.env.QZ_PRIVATE_KEY_B64);
  if (!key) return next(new ApiError(503, 'Silent printing key is not configured'));
  const { message } = req.body || {};
  if (typeof message !== 'string' || message.length === 0 || message.length > 500_000) {
    return next(new ApiError(400, 'message is required'));
  }
  try {
    const signature = crypto.createSign('RSA-SHA512').update(message).sign(key, 'base64');
    res.type('text/plain').send(signature);
  } catch {
    next(new ApiError(500, 'Could not sign the print request'));
  }
});

export default router;
