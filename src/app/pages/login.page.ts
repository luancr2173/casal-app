import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BrandLogoComponent } from '../shared/ui/brand-logo.component';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';
import { InputComponent } from '../shared/ui/input.component';

@Component({
  selector: 'app-login-page',
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
    <section class="auth-page">
      <app-brand-logo />
      <h1>Que bom ter vocês aqui</h1>
      <p class="auth-page__intro">Entre para continuar construindo momentos juntos.</p>
      <app-card>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-input
            label="E-mail"
            type="email"
            autocomplete="email"
            placeholder="voce@exemplo.com"
            formControlName="email"
            [error]="emailError()"
          />
          <app-input
            label="Senha"
            type="password"
            autocomplete="current-password"
            placeholder="Sua senha"
            formControlName="password"
            [error]="passwordError()"
          />
          @if (error()) {
            <p
              class="form-message motion-message-enter"
              role="alert"
              aria-live="polite"
              animate.leave="message-exit"
            >
              {{ error() }}
            </p>
          }
          <app-button type="submit" [disabled]="loading()" [loading]="loading()">
            {{ loading() ? 'Entrando…' : 'Entrar' }}
          </app-button>
        </form>
      </app-card>
      <p class="auth-page__footer">
        Ainda não tem uma conta? <a routerLink="/cadastro">Criar conta</a>
      </p>
    </section>
  `,
  styles: [
    `
      .auth-page {
        display: grid;
        gap: 20px;
        padding-top: 48px;
      }

      .auth-page__intro,
      .auth-page__footer {
        margin: -12px 0 0;
        line-height: 1.5;
      }

      form {
        display: grid;
        gap: 20px;
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

      .form-message {
        margin: 0;
        color: var(--danger);
      }
    `,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched && !this.submitted()) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Informe seu e-mail.';
    }
    return control.hasError('email') ? 'Digite um e-mail válido.' : null;
  }

  passwordError(): string | null {
    return (this.form.controls.password.touched || this.submitted()) &&
      this.form.controls.password.hasError('required')
      ? 'Informe sua senha.'
      : null;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      await this.router.navigateByUrl('/inicio');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      this.error.set(
        message.includes('invalid login credentials')
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar. Confira seus dados e tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
