import { Router } from 'express';
import { validateRequest } from '../../middleware/validateRequest.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginSchema, changePasswordSchema, switchOutletSchema } from './auth.schema.js';
import {
  loginHandler, changePasswordHandler, meHandler, switchOutletHandler,
} from './auth.controller.js';

const router = Router();

router.post('/login', validateRequest(loginSchema), loginHandler);
router.get('/me', requireAuth, meHandler);
router.post('/switch-outlet', requireAuth, validateRequest(switchOutletSchema), switchOutletHandler);
router.post('/change-password', requireAuth, validateRequest(changePasswordSchema), changePasswordHandler);

export default router;
