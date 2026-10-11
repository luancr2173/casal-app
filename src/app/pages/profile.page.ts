import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CoupleService } from '../core/couple.service';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';

@Component({
  selector: 'app-profile-page',
  imports: [ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="profile-page">
      <h1>Perfil</h1>
      @if (couples.loaded()) {
        <app-card>
          <dl>
            <div>
              <dt>Seu nome</dt>
              <dd>{{ couples.profile()?.name || '—' }}</dd>
            </div>
            <div>
              <dt>Nome do casal</dt>
              <dd>{{ couples.couple()?.name || 'Nosso espaço' }}</dd>
            </div>
            <div>
              <dt>Seu par</dt>
              <dd>{{ couples.partner()?.name || 'Aguardando parceiro(a)' }}</dd>
            </div>
          </dl>
          @if (!couples.partner() && couples.couple(); as couple) {
            <div class="invite">
              <p>Código de convite</p>
              <p class="invite__code">{{ couple.invite_code }}</p>
              <app-button variant="secondary" (click)="copyCode(couple.invite_code)">
                {{ copied() ? 'Código copiado' : 'Copiar código' }}
              </app-button>
            </div>
          }
        </app-card>
      } @else {
        <p role="status" aria-live="polite">Carregando perfil…</p>
      }
      @if (error()) {
        <p role="alert" aria-live="polite">{{ error() }}</p>
      }
      <app-button variant="secondary" [disabled]="loading()" (click)="signOut()">
        {{ loading() ? 'Saindo…' : 'Sair' }}
      </app-button>
    </section>
  `,
  styles: [
    `
      .profile-page {
        display: grid;
        gap: 24px;
        padding-top: 32px;
      }

      dl {
        display: grid;
        gap: 20px;
        margin: 0;
      }

      dt,
      .invite > p:first-child {
        color: var(--text-secondary);
        font-size: 13px;
      }

      dd {
        margin: 5px 0 0;
        color: var(--text);
        font-size: 17px;
      }

      .invite {
        display: grid;
        gap: 12px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      }

      .invite p {
        margin: 0;
      }

      .invite__code {
        color: var(--text);
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 0.12em;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class ProfilePage {
  readonly couples = inject(CoupleService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly copied = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
    } catch {
      this.error.set('Não foi possível copiar o código. Selecione e copie manualmente.');
    }
  }

  async signOut(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/entrar');
    } catch {
      this.error.set('Não foi possível sair agora. Tente novamente.');
    } finally {
      this.loading.set(false);
    }
  }
}
