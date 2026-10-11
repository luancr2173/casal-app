import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CoupleService } from '../core/couple.service';
import { CoverService } from '../core/cover.service';
import { ThemeService, type ThemeMode } from '../core/theme.service';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';

@Component({
  selector: 'app-profile-page',
  imports: [ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="profile-page">
      <h1>Perfil</h1>
      @if (couples.loaded()) {
        <app-card>
          <section class="couple-photo" aria-labelledby="couple-photo-title">
            <div class="couple-photo__preview">
              @if (photoUrl(); as photo) {
                <button
                  class="couple-photo__image-button"
                  type="button"
                  aria-label="Visualizar foto do casal ampliada"
                  (click)="openPhotoPreview()"
                >
                  <img [src]="photo" alt="Foto do casal" />
                </button>
              } @else {
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                </svg>
              }
            </div>
            <div class="couple-photo__details">
              <h2 id="couple-photo-title">Foto do casal</h2>
              <p>Escolha uma imagem para representar vocês.</p>
              @if (couples.photoSchemaAvailable()) {
                <label class="photo-upload">
                  <span>{{ photoSaving() ? 'Enviando foto…' : 'Enviar foto' }}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Enviar foto do casal"
                    aria-describedby="photo-upload-help"
                    [disabled]="photoSaving()"
                    (change)="uploadPhoto($event)"
                  />
                </label>
              } @else {
                <span class="photo-upload__pending">
                  Aplique a migração do Supabase para habilitar o envio.
                </span>
              }
              <span id="photo-upload-help" class="photo-upload__help">
                JPG, PNG ou WebP. Até 10 MB.
              </span>
            </div>
          </section>
          @if (photoSaving()) {
            <p class="photo-loading" role="status" aria-live="polite">
              <span class="motion-spinner" aria-hidden="true"></span> Enviando e salvando a foto…
            </p>
          }
          @if (photoError()) {
            <p
              class="profile-error motion-message-enter"
              role="alert"
              aria-live="polite"
              animate.leave="message-exit"
            >
              {{ photoError() }}
            </p>
          }
          @if (couples.couple()?.photo_path && !photoUrl() && !photoError()) {
            <p class="photo-loading" role="status" aria-live="polite">
              <span class="motion-spinner" aria-hidden="true"></span> Carregando foto…
            </p>
          }
          <dl>
            <div>
              <dt>Seu nome</dt>
              <dd>{{ couples.profile()?.name || '—' }}</dd>
            </div>
            <div>
              <dt>Nome do casal</dt>
              <dd>{{ couples.couple()?.name || 'Nosso espaço' }}</dd>
            </div>
            <div>
              <dt>Seu par</dt>
              <dd>{{ couples.partner()?.name || 'Aguardando parceiro(a)' }}</dd>
            </div>
          </dl>
          @if (!couples.partner() && couples.couple(); as couple) {
            <div class="invite">
              <p>Código de convite</p>
              <p class="invite__code">{{ couple.invite_code }}</p>
              <app-button variant="secondary" (click)="copyCode(couple.invite_code)">
                {{ copied() ? 'Código copiado' : 'Copiar código' }}
              </app-button>
            </div>
          }
        </app-card>
        <dialog
          #photoDialog
          class="couple-photo__dialog"
          aria-labelledby="couple-photo-dialog-title"
          (click)="closePhotoDialogFromBackdrop($event)"
        >
          @if (photoUrl(); as photo) {
            <header>
              <h2 id="couple-photo-dialog-title">Foto do casal</h2>
              <button
                class="couple-photo__dialog-close"
                type="button"
                aria-label="Fechar foto ampliada"
                (click)="closePhotoPreview()"
              >
                ×
              </button>
            </header>
            <img class="couple-photo__dialog-image" [src]="photo" alt="Foto do casal ampliada" />
          }
        </dialog>
      } @else {
        <p role="status" aria-live="polite">
          <span class="motion-spinner" aria-hidden="true"></span> Carregando perfil…
        </p>
      }
      @if (error()) {
        <p
          class="profile-error motion-message-enter"
          role="alert"
          aria-live="polite"
          animate.leave="message-exit"
        >
          {{ error() }}
        </p>
      }
      <app-card>
        <section class="appearance" aria-labelledby="appearance-title">
          <div>
            <h2 id="appearance-title">Aparência</h2>
            <p>Escolha como o CasalApp deve aparecer neste dispositivo.</p>
          </div>
          <div class="segmented" role="radiogroup" aria-label="Tema do aplicativo">
            @for (option of themeOptions; track option.value; let index = $index) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="theme.mode() === option.value"
                [attr.tabindex]="theme.mode() === option.value ? 0 : -1"
                [class.segmented__option--active]="theme.mode() === option.value"
                (click)="theme.setMode(option.value)"
                (keydown)="onThemeKeydown($event, index)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </section>
      </app-card>
      <app-button
        variant="secondary"
        [disabled]="loading()"
        [loading]="loading()"
        (click)="signOut()"
      >
        {{ loading() ? 'Saindo…' : 'Sair' }}
      </app-button>
    </section>
  `,
  styles: [
    `
      .profile-page {
        display: grid;
        gap: 24px;
        padding-top: 32px;
      }

      .couple-photo {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--border);
      }

      .couple-photo__preview {
        display: grid;
        width: 96px;
        height: 96px;
        flex: 0 0 auto;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 50%;
        background: var(--fill);
        color: var(--text-secondary);
      }

      .couple-photo__preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .couple-photo__image-button {
        display: block;
        width: 100%;
        height: 100%;
        padding: 0;
        overflow: hidden;
        border: 0;
        border-radius: inherit;
        background: transparent;
        cursor: pointer;
        transition: transform var(--dur-fast) var(--ease-ios);
      }

      .couple-photo__image-button:active {
        transform: scale(0.96);
      }

      .couple-photo__image-button:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }

      .couple-photo__dialog {
        position: fixed;
        width: min(calc(100% - 32px), 560px);
        max-width: none;
        max-height: min(90dvh, 700px);
        padding: 16px;
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
      }

      .couple-photo__dialog::backdrop {
        background: var(--scrim);
      }

      .couple-photo__dialog[open] {
        animation: ui-message-enter var(--dur) var(--ease-out) both;
      }

      .couple-photo__dialog header {
        display: flex;
        min-height: 44px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .couple-photo__dialog h2 {
        margin: 0;
        font-size: 18px;
      }

      .couple-photo__dialog-image {
        display: block;
        width: 100%;
        max-height: min(65dvh, 560px);
        border-radius: 14px;
        object-fit: contain;
      }

      .couple-photo__dialog-close {
        display: grid;
        width: 44px;
        height: 44px;
        flex: 0 0 auto;
        place-items: center;
        border: 0;
        border-radius: 50%;
        background: var(--fill);
        color: var(--text);
        font: inherit;
        font-size: 28px;
        cursor: pointer;
      }

      .couple-photo__dialog-close:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .couple-photo__preview svg {
        width: 36px;
        height: 36px;
      }

      .couple-photo__details {
        display: grid;
        min-width: 0;
        justify-items: start;
        gap: 7px;
      }

      .couple-photo__details h2 {
        margin: 0;
        font-size: 17px;
      }

      .couple-photo__details p,
      .photo-upload__help {
        margin: 0;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.4;
      }

      .photo-upload__pending {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.4;
      }

      .photo-upload {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        border: 1px solid var(--border);
        border-radius: 980px;
        background: var(--fill);
        color: var(--text);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color var(--dur-fast) var(--ease-out),
          color var(--dur-fast) var(--ease-out),
          transform var(--dur-fast) var(--ease-ios);
      }

      .photo-upload:active {
        transform: scale(0.98);
      }

      .photo-upload:focus-within {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .photo-upload input {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .photo-upload:has(input:disabled) {
        cursor: wait;
        opacity: 0.65;
      }

      .photo-loading {
        margin: -12px 0 20px;
        color: var(--text-secondary);
        font-size: 13px;
      }

      dl {
        display: grid;
        gap: 20px;
        margin: 0;
      }

      dt,
      .invite > p:first-child {
        color: var(--text-secondary);
        font-size: 13px;
      }

      dd {
        margin: 5px 0 0;
        color: var(--text);
        font-size: 17px;
      }

      .invite {
        display: grid;
        gap: 12px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      }

      .invite p {
        margin: 0;
      }

      .invite__code {
        color: var(--text);
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 0.12em;
        overflow-wrap: anywhere;
      }

      .appearance {
        display: grid;
        gap: 18px;
      }

      .appearance h2 {
        margin: 0;
      }

      .appearance p {
        margin: 8px 0 0;
        line-height: 1.45;
      }

      .segmented {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--fill);
      }

      .profile-error {
        margin: 0;
        color: var(--danger);
      }
    `,
  ],
})
export class ProfilePage {
  readonly couples = inject(CoupleService);
  readonly theme = inject(ThemeService);
  private readonly covers = inject(CoverService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly photoDialog = viewChild<ElementRef<HTMLDialogElement>>('photoDialog');

  readonly photoSaving = signal(false);
  readonly photoError = signal<string | null>(null);
  readonly photoUrl = computed(() => {
    const path = this.couples.couple()?.photo_path;
    return path ? this.covers.urlForPath(path) : null;
  });
  readonly copied = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  protected readonly themeOptions: readonly { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Escuro' },
  ];

  constructor() {
    effect(() => {
      const path = this.couples.couple()?.photo_path;
      if (path) {
        void this.covers.prime([path]).catch((error: unknown) => {
          this.photoError.set(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar a foto do casal.',
          );
        });
      }
    });
    this.destroyRef.onDestroy(() => this.covers.stopRenewal());
  }

  async uploadPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.photoError.set(null);
    this.photoSaving.set(true);
    let uploadedPath: string | null = null;
    const previousPath = this.couples.couple()?.photo_path;
    try {
      const image = await this.covers.processImage(file);
      uploadedPath = await this.covers.upload(image);
      await this.couples.setPhotoPath(uploadedPath);
      uploadedPath = null;
      if (previousPath && previousPath !== this.couples.couple()?.photo_path) {
        await this.covers.remove(previousPath);
      }
    } catch (error: unknown) {
      if (uploadedPath) {
        await this.covers.remove(uploadedPath);
      }
      this.photoError.set(
        error instanceof Error ? error.message : 'Não foi possível enviar a foto do casal.',
      );
    } finally {
      this.photoSaving.set(false);
    }
  }

  protected openPhotoPreview(): void {
    const dialog = this.photoDialog()?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  protected closePhotoPreview(): void {
    this.photoDialog()?.nativeElement.close();
  }

  protected closePhotoDialogFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePhotoPreview();
    }
  }

  protected onThemeKeydown(event: KeyboardEvent, index: number): void {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % this.themeOptions.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + this.themeOptions.length) % this.themeOptions.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.themeOptions.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const option = this.themeOptions[nextIndex];
    this.theme.setMode(option.value);
    (event.currentTarget as HTMLElement)
      .parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]
      ?.focus();
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      this.error.set('Não foi possível copiar o código. Selecione e copie manualmente.');
    }
  }

  async signOut(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/entrar');
    } catch {
      this.error.set('Não foi possível sair agora. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
