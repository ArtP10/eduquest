import { HttpInterceptorFn } from '@angular/common/http';
import { getStoredToken } from './token-storage';

/** Attaches the stored JWT to outgoing requests, if any. Nothing today requires it — this exists for future protected endpoints (quiz builder). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = getStoredToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
