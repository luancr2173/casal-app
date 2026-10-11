import { effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import type { Couple, Profile } from './models';
import { SupabaseService } from './supabase.service';

export interface Partner {
  id: string;
  name: string;
}

const rpcErrorMessages: Record<string, string> = {
  not_authenticated: 'Entre na sua conta para continuar.',
  already_in_couple: 'Você já faz parte de um espaço.',
  invalid_code: 'Esse código de convite não é válido.',
  couple_full: 'Esse espaço já está completo.',
};

function translatedRpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : '';
  const code = Object.keys(rpcErrorMessages).find((item) => message.includes(item));

  return new Error(code ? rpcErrorMessages[code] : 'Algo deu errado. Tente novamente.');
}

function isCouple(value: unknown): value is Couple {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record['id'] === 'string' &&
    (typeof record['name'] === 'string' || record['name'] === null) &&
    typeof record['invite_code'] === 'string' &&
    typeof record['created_at'] === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class CoupleService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private loadSequence = 0;
  private loadedUserId: string | null | undefined;
  private activeLoad: { userId: string; promise: Promise<void> } | null = null;

  readonly profile = signal<Profile | null>(null);
  readonly couple = signal<Couple | null>(null);
  readonly partner = signal<Partner | null>(null);
  readonly loaded = signal(false);
  readonly photoSchemaAvailable = signal(true);

  constructor() {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;

      if (!userId) {
        this.loadSequence++;
        this.activeLoad = null;
        this.clearState();
        this.loadedUserId = null;
        this.loaded.set(true);
        return;
      }

      void this.load().catch((error: unknown) => {
        console.error('Falha ao carregar os dados do casal.', error);
      });
    });
  }

  async load(): Promise<void> {
    await this.auth.ready();
    const user = this.auth.user();

    if (!user) {
      this.loadSequence++;
      this.activeLoad = null;
      this.clearState();
      this.loadedUserId = null;
      this.loaded.set(true);
      return;
    }

    if (this.loaded() && this.loadedUserId === user.id) {
      return;
    }

    if (this.activeLoad?.userId === user.id) {
      return this.activeLoad.promise;
    }

    this.clearState();
    this.loaded.set(false);
    const sequence = ++this.loadSequence;
    const userId = user.id;
    const promise = Promise.resolve().then(async () => {
      const { data: profile, error: profileError } = await this.supabase.client
        .from('profiles')
        .select('id, couple_id, name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (sequence !== this.loadSequence || this.auth.user()?.id !== userId) {
        return;
      }

      if (!profile) {
        this.profile.set(null);
        return;
      }

      this.profile.set(profile);

      if (!profile.couple_id) {
        return;
      }

      const [{ data: couple, error: coupleError }, { data: partners, error: partnerError }] =
        await Promise.all([
          this.supabase.client
            .from('couples')
            .select('*')
            .eq('id', profile.couple_id)
            .maybeSingle(),
          this.supabase.client
            .from('profiles')
            .select('id, name')
            .eq('couple_id', profile.couple_id)
            .neq('id', userId)
            .limit(1),
        ]);

      if (coupleError) {
        throw coupleError;
      } else {
        this.photoSchemaAvailable.set(
          couple !== null && Object.prototype.hasOwnProperty.call(couple, 'photo_path'),
        );
      }

      if (partnerError) {
        throw partnerError;
      }

      if (sequence !== this.loadSequence || this.auth.user()?.id !== userId) {
        return;
      }

      this.couple.set(couple);
      const partner = partners?.[0];
      this.partner.set(partner ? { id: partner.id, name: partner.name } : null);
    });

    this.activeLoad = { userId, promise };

    try {
      await promise;
    } finally {
      if (sequence === this.loadSequence) {
        this.loadedUserId = userId;
        this.loaded.set(true);
        this.activeLoad = null;
      }
    }
  }

  async ready(): Promise<void> {
    await this.auth.ready();
    if (!this.auth.user()) {
      return;
    }

    await this.load();
  }

  async createCouple(name?: string): Promise<Couple> {
    const { data, error } = await this.supabase.client.rpc('create_couple', {
      p_name: name?.trim() || null,
    });

    if (error) {
      throw translatedRpcError(error);
    }

    const createdCouple = Array.isArray(data) ? data[0] : data;
    if (!isCouple(createdCouple)) {
      throw new Error('Algo deu errado. Tente novamente.');
    }

    this.invalidateLoadedState();
    await this.load();
    return this.couple() ?? createdCouple;
  }

  async joinCouple(code: string): Promise<void> {
    const normalizedCode = code.replace(/\s/g, '').toUpperCase();
    const { error } = await this.supabase.client.rpc('join_couple', {
      p_code: normalizedCode,
    });

    if (error) {
      throw translatedRpcError(error);
    }

    this.invalidateLoadedState();
    await this.load();
  }

  async setPhotoPath(photoPath: string | null): Promise<void> {
    const { error } = await this.supabase.client.rpc('set_couple_photo', {
      p_photo_path: photoPath,
    });

    if (error) {
      throw new Error('Não foi possível salvar a foto do casal. Tente novamente.');
    }

    this.couple.update((current) => (current ? { ...current, photo_path: photoPath } : current));
  }

  private clearState(): void {
    this.profile.set(null);
    this.couple.set(null);
    this.partner.set(null);
    this.photoSchemaAvailable.set(true);
  }

  private invalidateLoadedState(): void {
    this.loadSequence++;
    this.activeLoad = null;
    this.loadedUserId = undefined;
    this.clearState();
    this.loaded.set(false);
  }
}
