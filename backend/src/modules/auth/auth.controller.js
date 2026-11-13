import * as authService from './auth.service.js';

export async function loginHandler(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req, res, next) {
  try {
    const access = await authService.getMe(req.user.id);
    res.json({ success: true, data: access });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const result = await authService.changePassword({ userId: req.user.id, ...req.body });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
