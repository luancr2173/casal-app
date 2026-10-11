import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

@Component({
  selector: 'app-sheet',
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="sheet-backdrop"
        [class.sheet-backdrop--closing]="closing()"
        (click)="close()"
        (keydown.escape)="close($event)"
      >
        <section
          class="sheet-panel"
          [class.sheet-panel--closing]="closing()"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title() || 'Janela de diálogo'"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="$event.stopPropagation()"
        >
          <div class="sheet__handle" aria-hidden="true"></div>
          <header class="sheet__header">
            @if (title()) {
              <h2>{{ title() }}</h2>
            }
            <button class="sheet__close" type="button" aria-label="Fechar" (click)="close()">
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div class="sheet__content">
            <ng-content />
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .sheet-backdrop {
        position: fixed;
        z-index: 30;
        inset: 0;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-top: 24px;
        background: var(--scrim);
        opacity: 1;
        transition: opacity var(--dur) var(--ease-out);
        @starting-style {
          opacity: 0;
        }
      }

      .sheet-backdrop--closing {
        opacity: 0;
      }

      .sheet-panel {
        width: 100%;
        max-width: 720px;
        max-height: min(90dvh, 760px);
        overflow-y: auto;
        padding: 12px 20px calc(24px + env(safe-area-inset-bottom));
        border: 1px solid var(--border);
        border-radius: 22px 22px 0 0;
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
        opacity: 1;
        transform: translateY(0);
        transition:
          opacity 350ms var(--ease-ios),
          transform 350ms var(--ease-ios),
          background-color var(--dur) ease,
          color var(--dur) ease,
          border-color var(--dur) ease,
          box-shadow var(--dur) ease;
        @starting-style {
          opacity: 0;
          transform: translateY(28px);
        }
      }

      .sheet-panel--closing {
        opacity: 0;
        transform: translateY(100%);
      }

      .sheet__handle {
        width: 36px;
        height: 5px;
        margin: 0 auto 12px;
        border-radius: 999px;
        background: var(--border);
      }

      .sheet__header {
        display: flex;
        min-height: 44px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .sheet__header h2 {
        font-size: 20px;
      }

      .sheet__close {
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

      .sheet__close:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .sheet__close,
      .sheet-backdrop button {
        transition:
          background-color var(--dur-fast) var(--ease-out),
          color var(--dur-fast) var(--ease-out),
          transform var(--dur-fast) var(--ease-ios);
      }

      .sheet__close:active {
        transform: scale(0.96);
      }

      .sheet__content {
        padding-top: 12px;
      }

      @media (min-width: 768px) {
        .sheet-backdrop {
          align-items: center;
          padding: 24px;
        }

        .sheet-panel {
          width: min(100%, 560px);
          border-radius: var(--radius);
          padding: 20px 24px 24px;
          @starting-style {
            opacity: 0;
            transform: scale(0.98);
          }
        }

        .sheet-panel--closing {
          transform: scale(0.98);
        }
      }
    `,
  ],
})
export class SheetComponent {
  private readonly destroyRef = inject(DestroyRef);
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;
  private notifyOnClose = false;

  readonly open = input(false);
  readonly title = input<string | undefined>();
  readonly closed = output<void>();
  readonly visible = signal(false);
  readonly closing = signal(false);

  constructor() {
    effect(() => {
      const isOpen = this.open();
      untracked(() => {
        if (isOpen) {
          if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
          }
          this.closing.set(false);
          this.visible.set(true);
        } else if (this.visible() && !this.closing()) {
          this.startClosing(false);
        }
      });
    });
    this.destroyRef.onDestroy(() => {
      if (this.closeTimeout) {
        clearTimeout(this.closeTimeout);
      }
    });
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.startClosing(true);
  }

  private startClosing(notify: boolean): void {
    if (this.closing()) {
      return;
    }
    this.notifyOnClose = notify;
    this.closing.set(true);
    this.closeTimeout = setTimeout(() => {
      this.visible.set(false);
      this.closing.set(false);
      this.closeTimeout = null;
      if (this.notifyOnClose) {
        this.notifyOnClose = false;
        this.closed.emit();
      }
    }, this.closeDuration());
  }

  private closeDuration(): number {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : 350;
  }
}
