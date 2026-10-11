import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextInputId = 0;

@Component({
  selector: 'app-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="field">
      <label [for]="inputId">{{ label() }}</label>
      <input
        [id]="inputId"
        [type]="type()"
        [placeholder]="placeholder()"
        [autocomplete]="autocomplete()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-describedby]="error() ? errorId : null"
        (input)="handleInput($event)"
        (blur)="handleBlur()"
      />
      @if (error(); as message) {
        <p class="field__error" [id]="errorId" aria-live="polite">{{ message }}</p>
      }
    </div>
  `,
  styles: [
    `
      .field {
        display: grid;
        gap: 8px;
      }

      label {
        color: var(--text);
        font-size: 14px;
        font-weight: 600;
      }

      input {
        width: 100%;
        min-height: 52px;
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: 12px;
        outline: 2px solid transparent;
        outline-offset: 2px;
        background: var(--fill);
        color: var(--text);
        font: inherit;
        transition:
          outline-color var(--dur-fast) var(--ease-out),
          background-color var(--dur) ease,
          color var(--dur) ease,
          border-color var(--dur) ease;
      }

      input:focus-visible {
        outline-color: var(--accent);
      }

      input:disabled {
        cursor: not-allowed;
        color: var(--text-secondary);
      }

      .field__error {
        margin: 0;
        color: var(--danger);
        font-size: 12px;
      }

      input::placeholder {
        color: var(--text-secondary);
        opacity: 1;
      }
    `,
  ],
})
export class InputComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly type = input('text');
  readonly placeholder = input('');
  readonly error = input<string | null>(null);
  readonly autocomplete = input('off');

  protected readonly inputId = `app-input-${nextInputId++}`;
  protected readonly errorId = `${this.inputId}-error`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.onChange(value);
  }

  protected handleBlur(): void {
    this.onTouched();
  }
}
