import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BrandLogoComponent } from '../shared/ui/brand-logo.component';

@Component({
  selector: 'app-auth-callback-page',
  imports: [RouterLink, BrandLogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="callback-page" aria-live="polite">
      <app-brand-logo />
      @if (error()) {
        <h1>Não foi possível confirmar</h1>
        <p role="alert">{{ error() }}</p>
        <a routerLink="/entrar">Voltar para entrar</a>
      } @else {
        <h1>Confirmando seu acesso</h1>
        <p>Estamos finalizando a autenticação com segurança.</p>
      }
    </section>
  `,
  styles: [
    `
      .callback-page {
        display: grid;
        gap: 20px;
        padding-top: 48px;
      }

      p {
        margin: -12px 0 0;
        line-height: 1.5;
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
export class AuthCallbackPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.route.snapshot.queryParamMap.has('error')) {
      this.error.set('O link expirou ou não é mais válido. Solicite um novo e-mail.');
      return;
    }

    void this.auth
      .completeAuthCallback(window.location.href)
      .then((next) => this.router.navigateByUrl(next))
      .catch(() => {
        this.error.set('O link expirou ou não é mais válido. Solicite um novo e-mail.');
      });
  }
}
