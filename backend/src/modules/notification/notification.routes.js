import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listForUser, markRead, markAllRead, clearAll,
} from './notification.service.js';

const router = Router();
router.use(requireAuth);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get('/', wrap(async (req, res) => {
  const data = await listForUser(req.user.tenantId, req.user.id, {
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly === 'true',
  });
  res.json({ success: true, data });
}));

router.post('/read-all', wrap(async (req, res) => {
  await markAllRead(req.user.tenantId, req.user.id);
  res.json({ success: true });
}));

router.post('/clear', wrap(async (req, res) => {
  await clearAll(req.user.tenantId, req.user.id);
  res.json({ success: true });
}));

router.post('/:id/read', wrap(async (req, res) => {
  await markRead(req.user.tenantId, req.user.id, req.params.id);
  res.json({ success: true });
}));

export default router;
