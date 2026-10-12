import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private resolveInitialSession!: () => void;
  private readonly initialSessionReady = new Promise<void>((resolve) => {
    this.resolveInitialSession = resolve;
  });

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly loading = signal(true);

  constructor() {
    let authStateChanged = false;

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      authStateChanged = true;
      this.session.set(session);
      this.loading.set(false);
    });

    void this.supabase.client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        if (!authStateChanged) {
          this.session.set(data.session);
        }
      })
      .catch((error: unknown) => {
        console.error('Falha ao carregar a sessão inicial do Supabase.', error);
      })
      .finally(() => {
        this.loading.set(false);
        this.resolveInitialSession();
      });
  }

  ready(): Promise<void> {
    return this.initialSessionReady;
  }

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: this.authCallbackUrl('/espaco'),
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: this.authCallbackUrl('/redefinir-senha'),
    });

    if (error) {
      throw error;
    }
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });

    if (error) {
      throw error;
    }
  }

  async completeAuthCallback(callbackUrl: string): Promise<string> {
    await this.ready();
    const url = new URL(callbackUrl);
    const isNativeCallback =
      url.protocol === 'casalapp:' && url.hostname === 'auth' && url.pathname === '/callback';
    const isWebCallback =
      !Capacitor.isNativePlatform() &&
      url.origin === window.location.origin &&
      url.pathname === '/auth/callback';

    if (!isNativeCallback && !isWebCallback) {
      throw new Error('Este link de autenticação não é válido.');
    }

    const query = url.searchParams;
    const fragment = new URLSearchParams(url.hash.slice(1));
    const readParam = (name: string): string | null => query.get(name) ?? fragment.get(name);

    if (readParam('error') || readParam('error_description')) {
      throw new Error('O link expirou ou não é mais válido. Solicite um novo e-mail.');
    }

    const code = readParam('code');
    const tokenHash = readParam('token_hash');
    const accessToken = readParam('access_token');
    const refreshToken = readParam('refresh_token');
    const otpType = readParam('type');

    if (code) {
      const { error } = await this.supabase.client.auth.exchangeCodeForSession(code);
      if (error) {
        throw new Error('O link expirou ou não é mais válido. Solicite um novo e-mail.');
      }
    } else if (tokenHash && otpType) {
      if (
        otpType !== 'signup' &&
        otpType !== 'invite' &&
        otpType !== 'magiclink' &&
        otpType !== 'recovery' &&
        otpType !== 'email_change' &&
        otpType !== 'email'
      ) {
        throw new Error('O tipo deste link de autenticação não é compatível.');
      }

      const { error } = await this.supabase.client.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (error) {
        throw new Error('O link expirou ou não é mais válido. Solicite um novo e-mail.');
      }
    } else if (accessToken && refreshToken) {
      const { error } = await this.supabase.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        throw new Error('O link expirou ou não é mais válido. Solicite um novo e-mail.');
      }
    } else if (!this.session()) {
      throw new Error('O link não contém uma sessão válida. Solicite um novo e-mail.');
    }

    const next = query.get('next');
    return next === '/espaco' || next === '/redefinir-senha' ? next : '/inicio';
  }

  async signOut() {
    const { error } = await this.supabase.client.auth.signOut();

    if (error) {
      throw error;
    }
  }

  private authCallbackUrl(next: '/espaco' | '/redefinir-senha'): string {
    if (Capacitor.isNativePlatform()) {
      return `casalapp://auth/callback?next=${encodeURIComponent(next)}`;
    }

    const url = new URL('/auth/callback', window.location.origin);
    url.searchParams.set('next', next);
    return url.toString();
  }
}
