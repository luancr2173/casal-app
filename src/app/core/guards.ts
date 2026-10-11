import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CoupleService } from './couple.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready();

  return auth.user() ? true : router.parseUrl('/entrar');
};

export const coupleGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const coupleService = inject(CoupleService);
  const router = inject(Router);
  await auth.ready();

  if (!auth.user()) {
    return router.parseUrl('/entrar');
  }

  await coupleService.ready();
  return coupleService.couple() ? true : router.parseUrl('/espaco');
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const coupleService = inject(CoupleService);
  const router = inject(Router);
  await auth.ready();

  if (!auth.user()) {
    return true;
  }

  await coupleService.ready();
  return router.parseUrl(coupleService.couple() ? '/inicio' : '/espaco');
};
