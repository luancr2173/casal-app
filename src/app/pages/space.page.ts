import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CoupleService } from '../core/couple.service';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';
import { InputComponent } from '../shared/ui/input.component';

type SpaceAction = 'create' | 'join';

@Component({
  selector: 'app-space-page',
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent, InputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-page">
      <h1>Um espaço só de vocês</h1>
      <p>Crie um espaço ou entre com o código de convite do seu par.</p>
      <div class="segmented" role="group" aria-label="Escolha como começar">
        <button
          type="button"
          [class.segmented__option--active]="action() === 'create'"
          [attr.aria-pressed]="action() === 'create'"
          (click)="action.set('create'); error.set(null)"
        >
          Criar espaço
        </button>
        <button
          type="button"
          [class.segmented__option--active]="action() === 'join'"
          [attr.aria-pressed]="action() === 'join'"
          (click)="action.set('join'); error.set(null)"
        >
          Entrar com código
        </button>
      </div>

      @if (createdCouple(); as created) {
        <app-card>
          <div class="invite">
            <h2>Espaço criado</h2>
            <p>Compartilhe este código com seu par:</p>
            <p class="invite__code" aria-label="Código de convite">{{ created.invite_code }}</p>
            <app-button variant="secondary" (click)="copyCode(created.invite_code)">
              {{ copied() ? 'Código copiado' : 'Copiar código' }}
            </app-button>
            <app-button (click)="continueToApp()">Continuar</app-button>
          </div>
        </app-card>
      } @else if (action() === 'create') {
        <app-card>
          <form [formGroup]="createForm" (ngSubmit)="create()" novalidate>
            <app-input
              label="Nome do casal (opcional)"
              placeholder="Ex.: Ana e Bia"
              formControlName="name"
            />
            @if (error()) {
              <p class="form-message" role="alert" aria-live="polite">{{ error() }}</p>
            }
            <app-button type="submit" [disabled]="loading()">
              {{ loading() ? 'Criando…' : 'Criar' }}
            </app-button>
          </form>
        </app-card>
      } @else {
        <app-card>
          <form [formGroup]="joinForm" (ngSubmit)="join()" novalidate>
            <app-input
              label="Código de convite"
              placeholder="Digite o código"
              autocomplete="off"
              formControlName="code"
              [error]="codeError()"
              (input)="normalizeCode()"
            />
            @if (error()) {
              <p class="form-message" role="alert" aria-live="polite">{{ error() }}</p>
            }
            <app-button type="submit" [disabled]="loading()">
              {{ loading() ? 'Entrando…' : 'Entrar' }}
            </app-button>
          </form>
        </app-card>
      }
    </section>
  `,
  styles: [
    `
      .space-page {
        display: grid;
        gap: 20px;
        padding-top: 40px;
      }

      .space-page > p {
        margin: -12px 0 0;
        line-height: 1.5;
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
        padding: 8px 12px;
        border: 0;
        border-radius: 11px;
        background: transparent;
        color: var(--text-secondary);
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color var(--dur-fast) var(--ease-out),
          color var(--dur-fast) var(--ease-out),
          transform var(--dur-fast) var(--ease-ios);
      }

      .segmented button.segmented__option--active {
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
      }

      .segmented button:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .segmented button:active {
        transform: scale(0.98);
      }

      form,
      .invite {
        display: grid;
        gap: 20px;
      }

      .invite h2,
      .invite p {
        margin: 0;
      }

      .invite__code {
        color: var(--text);
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-align: center;
        overflow-wrap: anywhere;
      }

      .form-message {
        margin: 0;
        color: var(--danger);
        animation: auth-message-in var(--dur) var(--ease-out) both;
      }

      @keyframes auth-message-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class SpacePage {
  private readonly couples = inject(CoupleService);
  private readonly router = inject(Router);

  readonly action = signal<SpaceAction>('create');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  readonly submitted = signal(false);
  readonly createdCouple = signal<{ invite_code: string } | null>(null);
  readonly createForm = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
  });
  readonly joinForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  codeError(): string | null {
    return (this.joinForm.controls.code.touched || this.submitted()) &&
      this.joinForm.controls.code.hasError('required')
      ? 'Informe o código de convite.'
      : null;
  }

  normalizeCode(): void {
    const control = this.joinForm.controls.code;
    const normalized = control.value.replace(/\s/g, '').toUpperCase();
    if (control.value !== normalized) {
      control.setValue(normalized);
    }
  }

  async create(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const couple = await this.couples.createCouple(this.createForm.controls.name.value);
      this.createdCouple.set(couple);
    } catch (error: unknown) {
      this.error.set(this.messageFrom(error));
    } finally {
      this.loading.set(false);
    }
  }

  async join(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);
    this.normalizeCode();

    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      await this.couples.joinCouple(this.joinForm.controls.code.value);
      await this.router.navigateByUrl('/inicio');
    } catch (error: unknown) {
      this.error.set(this.messageFrom(error));
    } finally {
      this.loading.set(false);
    }
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      this.error.set('Não foi possível copiar o código. Selecione e copie manualmente.');
    }
  }

  async continueToApp(): Promise<void> {
    await this.router.navigateByUrl('/inicio');
  }

  private messageFrom(error: unknown): string {
    return error instanceof Error && error.message
      ? error.message
      : 'Algo deu errado. Tente novamente.';
  }
}
