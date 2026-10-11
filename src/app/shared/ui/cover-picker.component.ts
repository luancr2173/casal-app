import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CoverService } from '../../core/cover.service';
import { CoverComponent } from './cover.component';

export type CoverSelection = { kind: 'file'; blob: Blob } | { kind: 'url'; url: string };
type PickerMode = 'file' | 'url';

@Component({
  selector: 'app-cover-picker',
  imports: [CoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <div class="segmented" role="group" aria-label="Escolha a origem da capa">
        <button
          type="button"
          [class.segmented__option--active]="mode() === 'file'"
          [attr.aria-pressed]="mode() === 'file'"
          (click)="setMode('file')"
        >
          Enviar imagem
        </button>
        <button
          type="button"
          [class.segmented__option--active]="mode() === 'url'"
          [attr.aria-pressed]="mode() === 'url'"
          (click)="setMode('url')"
        >
          Colar link
        </button>
      </div>

      @if (mode() === 'file') {
        <div class="picker__actions">
          <input
            #fileInput
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Selecionar imagem da capa"
            (change)="chooseFile($event)"
          />
          <button class="action-button" type="button" (click)="openFilePicker()">
            Escolher imagem
          </button>
          @if (hasCover()) {
            <button class="text-button" type="button" (click)="removeCover()">Remover</button>
          }
        </div>
      } @else {
        <label [for]="urlInputId">Link da imagem (HTTPS)</label>
        <input
          [id]="urlInputId"
          class="url-input"
          type="url"
          autocomplete="url"
          placeholder="https://exemplo.com/capa.jpg"
          [value]="urlValue()"
          [attr.aria-invalid]="error() ? 'true' : null"
          aria-describedby="cover-picker-error"
          (input)="changeUrl($event)"
        />
        @if (error()) {
          <p id="cover-picker-error" class="picker__error" role="alert" aria-live="polite">
            {{ error() }}
          </p>
        }
      }

      @if (previewSrc()) {
        <div class="preview">
          <app-cover title="Prévia da capa" [src]="previewSrc()" size="small" />
          <span>Prévia da capa</span>
        </div>
      } @else {
        <p class="picker__hint">A capa é opcional. Você pode adicioná-la ou removê-la depois.</p>
      }
      @if (processing()) {
        <p class="picker__hint" role="status" aria-live="polite">Preparando imagem…</p>
      }
    </div>
  `,
  styles: [
    `
      .picker {
        display: grid;
        gap: 14px;
      }

      .segmented {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--fill);
      }

      .segmented button {
        min-height: 44px;
        padding: 8px;
        border: 0;
        border-radius: 11px;
        background: transparent;
        color: var(--text-secondary);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .segmented button.segmented__option--active {
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
      }

      .picker button:focus-visible,
      .url-input:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .picker__actions {
        display: flex;
        min-height: 44px;
        align-items: center;
        gap: 16px;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        clip-path: inset(50%);
      }

      .action-button,
      .text-button {
        min-height: 44px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: var(--fill);
        color: var(--text);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .text-button {
        padding: 0 8px;
        background: transparent;
        color: var(--accent);
      }

      label {
        color: var(--text);
        font-size: 14px;
        font-weight: 600;
      }

      .url-input {
        width: 100%;
        min-height: 52px;
        padding: 14px 16px;
        border: 0;
        border-radius: 12px;
        outline: 2px solid transparent;
        outline-offset: 2px;
        background: var(--fill);
        color: var(--text);
        font: inherit;
      }

      .picker__error,
      .picker__hint {
        margin: 0;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.4;
      }

      .preview {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--text-secondary);
        font-size: 13px;
      }
    `,
  ],
})
export class CoverPickerComponent {
  private readonly covers = inject(CoverService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private objectUrl: string | null = null;
  private static nextUrlInputId = 0;

  readonly changed = output<CoverSelection | null>();
  readonly valid = output<boolean>();
  readonly currentSrc = input<string | null>(null);
  readonly resetToken = input(0);
  readonly urlInputId = `cover-url-${CoverPickerComponent.nextUrlInputId++}`;
  readonly mode = signal<PickerMode>('file');
  readonly urlValue = signal('');
  readonly previewSrc = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly processing = signal(false);
  readonly hasCover = signal(false);
  private readonly hasLocalSelection = signal(false);

  constructor() {
    let previousResetToken = this.resetToken();
    effect(() => {
      const current = this.currentSrc();
      const resetToken = this.resetToken();
      const didReset = resetToken !== previousResetToken;
      if (didReset) {
        previousResetToken = resetToken;
        this.hasLocalSelection.set(false);
        this.revokePreview();
        this.urlValue.set('');
        this.error.set(null);
        this.valid.emit(true);
      }
      if (didReset || !this.hasLocalSelection()) {
        this.previewSrc.set(current);
        this.hasCover.set(!!current);
      }
    });
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  setMode(mode: PickerMode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.valid.emit(true);
  }

  openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  async chooseFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.error.set(null);
    this.processing.set(true);
    this.valid.emit(false);
    this.revokePreview();
    try {
      const blob = await this.covers.processImage(file);
      if (this.destroyRef.destroyed) {
        return;
      }

      this.objectUrl = URL.createObjectURL(blob);
      this.hasLocalSelection.set(true);
      this.previewSrc.set(this.objectUrl);
      this.hasCover.set(true);
      this.changed.emit({ kind: 'file', blob });
      this.valid.emit(true);
    } catch (error: unknown) {
      this.previewSrc.set(this.currentSrc());
      this.error.set(
        error instanceof Error ? error.message : 'Não foi possível processar essa imagem.',
      );
      this.valid.emit(false);
    } finally {
      this.processing.set(false);
    }
  }

  changeUrl(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.urlValue.set(raw);
    const url = this.covers.validateExternalUrl(raw);
    if (!url) {
      this.error.set(
        /^http:/i.test(raw.trim())
          ? 'Use um link que comece com https://'
          : 'Cole um link HTTPS válido com até 500 caracteres.',
      );
      this.previewSrc.set(null);
      this.valid.emit(false);
      return;
    }

    this.error.set(null);
    this.revokePreview();
    this.hasLocalSelection.set(true);
    this.previewSrc.set(url);
    this.hasCover.set(true);
    this.changed.emit({ kind: 'url', url });
    this.valid.emit(true);
  }

  removeCover(): void {
    this.revokePreview();
    this.hasLocalSelection.set(true);
    this.previewSrc.set(null);
    this.urlValue.set('');
    this.hasCover.set(false);
    this.error.set(null);
    this.changed.emit(null);
    this.valid.emit(true);
  }

  reset(): void {
    this.revokePreview();
    this.hasLocalSelection.set(false);
    this.previewSrc.set(this.currentSrc());
    this.hasCover.set(!!this.currentSrc());
    this.urlValue.set('');
    this.error.set(null);
    this.valid.emit(true);
    this.changed.emit(null);
  }

  private revokePreview(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
