import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [class]="'button button--' + variant()"
      [type]="type()"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
  styles: [
    `
      .button {
        min-height: 44px;
        padding: 11px 20px;
        border: 1px solid transparent;
        border-radius: 980px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 160ms ease, border-color 160ms ease, opacity 160ms ease;
      }

      .button:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }

      .button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .button--primary {
        background: var(--accent);
        color: var(--accent-text);
      }

      .button--secondary {
        border-color: var(--border);
        background: var(--fill);
        color: var(--text);
      }

      .button--ghost {
        background: transparent;
        color: var(--accent);
      }
    `,
  ],
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false);
}
