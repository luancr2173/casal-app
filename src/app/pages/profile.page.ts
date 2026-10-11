import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CoupleService } from '../core/couple.service';
import { ThemeService, type ThemeMode } from '../core/theme.service';
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
        <p role="status" aria-live="polite">
          <span class="motion-spinner" aria-hidden="true"></span> Carregando perfil…
        </p>
      }
      @if (error()) {
        <p
          class="profile-error motion-message-enter"
          role="alert"
          aria-live="polite"
          animate.leave="message-exit"
        >
          {{ error() }}
        </p>
      }
      <app-card>
        <section class="appearance" aria-labelledby="appearance-title">
          <div>
            <h2 id="appearance-title">Aparência</h2>
            <p>Escolha como o CasalApp deve aparecer neste dispositivo.</p>
          </div>
          <div class="segmented" role="radiogroup" aria-label="Tema do aplicativo">
            @for (option of themeOptions; track option.value; let index = $index) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="theme.mode() === option.value"
                [attr.tabindex]="theme.mode() === option.value ? 0 : -1"
                [class.segmented__option--active]="theme.mode() === option.value"
                (click)="theme.setMode(option.value)"
                (keydown)="onThemeKeydown($event, index)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </section>
      </app-card>
      <app-button
        variant="secondary"
        [disabled]="loading()"
        [loading]="loading()"
        (click)="signOut()"
      >
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

      .appearance {
        display: grid;
        gap: 18px;
      }

      .appearance h2 {
        margin: 0;
      }

      .appearance p {
        margin: 8px 0 0;
        line-height: 1.45;
      }

      .segmented {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border-radius: 14px;
        background: var(--fill);
      }

      .profile-error {
        margin: 0;
        color: var(--danger);
      }
    `,
  ],
})
export class ProfilePage {
  readonly couples = inject(CoupleService);
  readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly copied = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  protected readonly themeOptions: readonly { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Escuro' },
  ];

  protected onThemeKeydown(event: KeyboardEvent, index: number): void {
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % this.themeOptions.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + this.themeOptions.length) % this.themeOptions.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.themeOptions.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const option = this.themeOptions[nextIndex];
    this.theme.setMode(option.value);
    (event.currentTarget as HTMLElement)
      .parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]
      ?.focus();
  }

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
