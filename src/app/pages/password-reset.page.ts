import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BrandLogoComponent } from '../shared/ui/brand-logo.component';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';
import { InputComponent } from '../shared/ui/input.component';

@Component({
  selector: 'app-password-reset-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BrandLogoComponent,
    ButtonComponent,
    CardComponent,
    InputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="reset-page">
      <app-brand-logo />
      <h1>Escolha uma nova senha</h1>
      @if (checking()) {
        <p>Validando o link de redefinição…</p>
      } @else if (error() && !available()) {
        <p class="form-message" role="alert">{{ error() }}</p>
        <a routerLink="/recuperar-senha">Solicitar outro link</a>
      } @else {
        <p>Use pelo menos 6 caracteres para proteger sua conta.</p>
        <app-card>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <app-input
              label="Nova senha"
              type="password"
              autocomplete="new-password"
              placeholder="Pelo menos 6 caracteres"
              formControlName="password"
              [error]="passwordError()"
            />
            <app-input
              label="Confirme a nova senha"
              type="password"
              autocomplete="new-password"
              placeholder="Digite a senha novamente"
              formControlName="confirmation"
              [error]="confirmationError()"
            />
            @if (error()) {
              <p class="form-message" role="alert">{{ error() }}</p>
            }
            @if (saved()) {
              <p role="status">Senha atualizada. Você já pode continuar usando o Casal App.</p>
            }
            <app-button type="submit" [disabled]="loading()" [loading]="loading()">
              {{ loading() ? 'Salvando…' : 'Salvar nova senha' }}
            </app-button>
          </form>
        </app-card>
      }
    </section>
  `,
  styles: [
    `
      .reset-page {
        display: grid;
        gap: 20px;
        padding-top: 48px;
      }

      .reset-page > p {
        margin: -12px 0 0;
        line-height: 1.5;
      }

      form {
        display: grid;
        gap: 20px;
      }

      .form-message {
        margin: 0;
        color: var(--danger);
      }

      a {
        color: var(--accent);
        font-weight: 600;
      }

      a:focus-visible {
        border-radius: 3px;
        outline: 3px solid var(--accent);
        outline-offset: 3px;
      }
    `,
  ],
})
export class PasswordResetPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly checking = signal(true);
  protected readonly available = signal(false);
  protected readonly loading = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmation: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    void this.auth.ready().then(() => {
      this.available.set(this.auth.user() !== null);
      if (!this.available()) {
        this.error.set('O link expirou ou não é mais válido. Solicite um novo e-mail.');
      }
      this.checking.set(false);
    });
  }

  protected passwordError(): string | null {
    const password = this.form.controls.password;
    if (!password.touched && !this.submitted()) {
      return null;
    }
    if (password.hasError('required')) {
      return 'Informe uma senha.';
    }
    return password.hasError('minlength') ? 'A senha precisa ter pelo menos 6 caracteres.' : null;
  }

  protected confirmationError(): string | null {
    const confirmation = this.form.controls.confirmation;
    if (!confirmation.touched && !this.submitted()) {
      return null;
    }
    if (confirmation.hasError('required')) {
      return 'Confirme sua senha.';
    }
    return confirmation.value !== this.form.controls.password.value
      ? 'As senhas não coincidem.'
      : null;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);
    this.saved.set(false);

    if (this.form.invalid || this.confirmationError()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.updatePassword(this.form.controls.password.value);
      this.saved.set(true);
      await this.router.navigateByUrl('/inicio');
    } catch {
      this.error.set(
        'Não foi possível atualizar a senha. Solicite um novo link e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
