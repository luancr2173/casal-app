import { Injectable, inject, signal } from '@angular/core';
import { CoupleService } from './couple.service';
import type { ListItem } from './models';
import { SupabaseService } from './supabase.service';

const maxInputBytes = 10 * 1024 * 1024;
const maxOutputBytes = 2 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const signedUrlLifetimeSeconds = 60 * 60;
const refreshMarginMs = 5 * 60 * 1000;

interface SignedCover {
  url: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class CoverService {
  private readonly supabase = inject(SupabaseService);
  private readonly couples = inject(CoupleService);
  private activePaths: string[] = [];
  private renewalTimer: ReturnType<typeof setInterval> | null = null;
  private readonly inFlight = new Set<string>();
  private readonly signedUrlRequests = new Map<string, Promise<string>>();

  readonly signedUrls = signal<Record<string, SignedCover>>({});
  readonly signingError = signal<string | null>(null);

  async processImage(file: File): Promise<Blob> {
    if (!allowedTypes.has(file.type)) {
      throw new Error('Use uma imagem JPG, PNG ou WebP.');
    }

    if (file.size > maxInputBytes) {
      throw new Error('A imagem deve ter no máximo 10 MB.');
    }

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas indisponível.');
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error('Falha ao exportar imagem.'))),
            'image/jpeg',
            quality,
          );
        });

        if (blob.size < maxOutputBytes) {
          return blob;
        }
      }

      throw new Error('A imagem processada excede 2 MB.');
    } catch {
      throw new Error('Não foi possível processar essa imagem.');
    } finally {
      bitmap?.close();
    }
  }

  async upload(blob: Blob): Promise<string> {
    const coupleId = this.couples.couple()?.id;
    if (!coupleId) {
      throw new Error('Não foi possível salvar agora. Tente novamente.');
    }

    const path = `${coupleId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.supabase.client.storage.from('covers').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (error) {
      throw new Error('Não foi possível salvar agora. Tente novamente.');
    }

    return path;
  }

  async remove(path: string): Promise<void> {
    try {
      await this.supabase.client.storage.from('covers').remove([path]);
    } catch {
      return;
    } finally {
      this.signedUrls.update((current) => {
        const next = { ...current };
        delete next[path];
        return next;
      });
    }
  }

  validateExternalUrl(raw: string): string | null {
    if (raw.length > 500) {
      return null;
    }

    const value = raw.trim();

    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) {
        return null;
      }
      return url.href;
    } catch {
      return null;
    }
  }

  async prime(paths: string[], force = false): Promise<void> {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    this.activePaths = uniquePaths;
    if (uniquePaths.length) {
      this.startRenewal();
    } else {
      this.stopRenewal();
    }

    const now = Date.now();
    const cached = this.signedUrls();
    const toSign = uniquePaths.filter((path) => {
      const entry = cached[path];
      return force || !entry || entry.expiresAt - now <= refreshMarginMs;
    });

    if (!toSign.length) {
      return;
    }

    const pathsToSign = toSign.filter((path) => !this.inFlight.has(path));
    if (!pathsToSign.length) {
      return;
    }

    pathsToSign.forEach((path) => this.inFlight.add(path));
    try {
      const { data, error } = await this.supabase.client.storage
        .from('covers')
        .createSignedUrls(pathsToSign, signedUrlLifetimeSeconds);

      if (error || !data) {
        throw new Error('Não foi possível carregar as capas agora. Tente novamente.');
      }

      const expiresAt = Date.now() + signedUrlLifetimeSeconds * 1000;
      const updates: Record<string, SignedCover> = {};
      for (const result of data) {
        if (result.path && result.signedUrl) {
          updates[result.path] = { url: result.signedUrl, expiresAt };
        }
      }

      this.signedUrls.update((current) => ({ ...current, ...updates }));
      if (pathsToSign.some((path) => !updates[path])) {
        throw new Error('Não foi possível carregar algumas capas agora. Tente novamente.');
      }
      this.signingError.set(null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.signingError.set(error.message);
        throw error;
      }
      const message = 'Não foi possível carregar as capas agora. Tente novamente.';
      this.signingError.set(message);
      throw new Error(message);
    } finally {
      pathsToSign.forEach((path) => this.inFlight.delete(path));
    }
  }

  urlFor(item: ListItem): string | null {
    const path = item.metadata.cover_path;
    if (typeof path === 'string' && path) {
      return this.urlForPath(path);
    }
    return item.image_url;
  }

  urlForPath(path: string): string | null {
    return this.signedUrls()[path]?.url ?? null;
  }

  async signedUrlForPath(path: string): Promise<string> {
    const cached = this.signedUrls()[path];
    if (cached && cached.expiresAt - Date.now() > refreshMarginMs) {
      return cached.url;
    }

    const activeRequest = this.signedUrlRequests.get(path);
    if (activeRequest) {
      return activeRequest;
    }

    const request = (async () => {
      const { data, error } = await this.supabase.client.storage
        .from('covers')
        .createSignedUrl(path, signedUrlLifetimeSeconds);
      if (error || !data?.signedUrl) {
        throw new Error('Não foi possível carregar a foto do casal.');
      }

      this.signedUrls.update((current) => ({
        ...current,
        [path]: {
          url: data.signedUrl,
          expiresAt: Date.now() + signedUrlLifetimeSeconds * 1000,
        },
      }));
      return data.signedUrl;
    })();

    this.signedUrlRequests.set(path, request);
    try {
      return await request;
    } finally {
      this.signedUrlRequests.delete(path);
    }
  }

  stopRenewal(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
    this.activePaths = [];
  }

  private startRenewal(): void {
    if (this.renewalTimer) {
      return;
    }

    this.renewalTimer = setInterval(() => {
      void this.prime(this.activePaths, true).catch(() => {
        return;
      });
    }, 45 * 60 * 1000);
  }
}
