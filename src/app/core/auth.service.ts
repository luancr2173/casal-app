import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
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

  async signOut() {
    const { error } = await this.supabase.client.auth.signOut();

    if (error) {
      throw error;
    }
  }
}
