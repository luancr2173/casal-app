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
      [attr.aria-busy]="loading() ? 'true' : null"
    >
      <span class="button__label"><ng-content /></span>
      @if (loading()) {
        <span class="button__spinner" aria-hidden="true"></span>
      }
    </button>
  `,
  styles: [
    `
      .button {
        display: inline-flex;
        min-width: 44px;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        gap: 9px;
        padding: 11px 20px;
        border: 1px solid transparent;
        border-radius: 980px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color var(--dur-fast) var(--ease-out),
          border-color var(--dur-fast) var(--ease-out),
          color var(--dur-fast) var(--ease-out),
          opacity var(--dur-fast) var(--ease-out),
          transform var(--dur-fast) var(--ease-ios);
      }

      .button__label {
        min-width: 0;
      }

      .button:active:not(:disabled) {
        transform: scale(0.97);
      }

      .button__spinner {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: ui-spinner 700ms linear infinite;
      }

      @media (hover: hover) and (prefers-reduced-motion: no-preference) {
        .button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
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

      .button--primary:disabled,
      .button--secondary:disabled {
        border-color: var(--border);
        background: var(--fill);
        color: var(--text-secondary);
      }

      .button--ghost:disabled {
        color: var(--text-secondary);
      }
    `,
  ],
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
}
