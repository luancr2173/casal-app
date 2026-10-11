import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-sheet',
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="sheet-backdrop" (click)="close()" (keydown.escape)="close($event)">
        <section
          class="sheet-panel"
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
        background: rgb(0 0 0 / 48%);
        animation: backdrop-in 180ms ease both;
      }

      .sheet-panel {
        width: 100%;
        max-width: 720px;
        max-height: min(90dvh, 760px);
        overflow-y: auto;
        padding: 12px 20px calc(24px + env(safe-area-inset-bottom));
        border-radius: 22px 22px 0 0;
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
        animation: sheet-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
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
        }
      }

      @keyframes backdrop-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes sheet-in {
        from {
          opacity: 0.8;
          transform: translateY(24px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sheet-backdrop,
        .sheet-panel {
          animation-duration: 1ms;
        }
      }
    `,
  ],
})
export class SheetComponent {
  readonly open = input(false);
  readonly title = input<string | undefined>();
  readonly closed = output<void>();

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.closed.emit();
  }
}
