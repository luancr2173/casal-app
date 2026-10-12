import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BrandLogoComponent } from '../shared/ui/brand-logo.component';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';
import { InputComponent } from '../shared/ui/input.component';

@Component({
  selector: 'app-password-recovery-page',
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
    <section class="recovery-page">
      <app-brand-logo />
      <h1>Recuperar senha</h1>
      <p>Enviaremos um link seguro para o e-mail associado à sua conta.</p>
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
          @if (error()) {
            <p class="form-message" role="alert">{{ error() }}</p>
          }
          @if (sent()) {
            <p class="form-message" role="status">
              Se houver uma conta para esse e-mail, enviaremos as instruções para redefinir a senha.
            </p>
          }
          <app-button type="submit" [disabled]="loading()" [loading]="loading()">
            {{ loading() ? 'Enviando…' : 'Enviar link' }}
          </app-button>
        </form>
      </app-card>
      <a routerLink="/entrar">Voltar para entrar</a>
    </section>
  `,
  styles: [
    `
      .recovery-page {
        display: grid;
        gap: 20px;
        padding-top: 48px;
      }

      .recovery-page > p {
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
export class PasswordRecoveryPage {
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected emailError(): string | null {
    const email = this.form.controls.email;
    if (!email.touched && !this.submitted()) {
      return null;
    }
    if (email.hasError('required')) {
      return 'Informe seu e-mail.';
    }
    return email.hasError('email') ? 'Digite um e-mail válido.' : null;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set(null);
    this.sent.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.requestPasswordReset(this.form.controls.email.value.trim());
      this.sent.set(true);
    } catch {
      this.error.set('Não foi possível enviar o link. Confira sua conexão e tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
