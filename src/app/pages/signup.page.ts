import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BrandLogoComponent } from '../shared/ui/brand-logo.component';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';
import { InputComponent } from '../shared/ui/input.component';

@Component({
  selector: 'app-signup-page',
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
      <h1>Comecem por aqui</h1>
      <p class="auth-page__intro">Criem uma conta para guardar seus planos a dois.</p>
      <app-card>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <app-input
            label="Seu nome"
            autocomplete="name"
            placeholder="Como podemos chamar você?"
            formControlName="name"
            [error]="nameError()"
          />
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
            autocomplete="new-password"
            placeholder="Pelo menos 6 caracteres"
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
          @if (confirmation()) {
            <p
              class="form-message motion-message-enter"
              role="status"
              aria-live="polite"
              animate.leave="message-exit"
            >
              {{ confirmation() }}
            </p>
          }
          <app-button type="submit" [disabled]="loading()" [loading]="loading()">
            {{ loading() ? 'Criando…' : 'Criar conta' }}
          </app-button>
        </form>
      </app-card>
      <p class="auth-page__footer">
        Já tem uma conta? <a routerLink="/entrar">Entrar</a>
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
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly confirmation = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  nameError(): string | null {
    return (this.form.controls.name.touched || this.submitted()) &&
      this.form.controls.name.hasError('required')
      ? 'Informe seu nome.'
      : null;
  }

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
    const control = this.form.controls.password;
    if (!control.touched && !this.submitted()) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Informe sua senha.';
    }
    return control.hasError('minlength') ? 'A senha precisa ter pelo menos 6 caracteres.' : null;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);
    this.confirmation.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const { name, email, password } = this.form.getRawValue();
      const result = await this.auth.signUp(email, password, name.trim());
      if (!result.session) {
        this.confirmation.set('Enviamos um e-mail de confirmação. Confirme para entrar.');
        return;
      }

      await this.router.navigateByUrl('/espaco');
    } catch {
      this.error.set('Não foi possível criar sua conta. Confira seus dados e tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
