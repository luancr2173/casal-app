import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { TabBarComponent } from './shared/ui/tab-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main (click)="handleExternalLink($event)">
      @if (externalLinkError()) {
        <div class="native-error" role="alert">
          <span>{{ externalLinkError() }}</span>
          <button type="button" aria-label="Fechar aviso" (click)="externalLinkError.set(null)">
            Fechar
          </button>
        </div>
      }
      @if (isOffline()) {
        <div class="network-warning" role="status" aria-live="polite">
          Sem conexão. Algumas ações ficam indisponíveis até a conexão voltar.
        </div>
      }
      <router-outlet />
    </main>
    @if (showTabBar()) {
      <app-tab-bar />
    }
  `,
  styles: [
    `
      main {
        max-width: 720px;
        margin: 0 auto;
        padding: 0 20px calc(96px + env(safe-area-inset-bottom));
      }

      .native-error {
        position: fixed;
        z-index: 20;
        top: calc(12px + env(safe-area-inset-top));
        right: 16px;
        left: 16px;
        display: flex;
        max-width: 688px;
        margin: 0 auto;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
      }

      .network-warning {
        position: fixed;
        z-index: 20;
        top: calc(68px + env(safe-area-inset-top));
        right: 16px;
        left: 16px;
        max-width: 688px;
        margin: 0 auto;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow);
      }

      .native-error button {
        min-height: 44px;
        padding: 8px;
        border: 0;
        background: transparent;
        color: var(--accent);
        font: inherit;
        font-weight: 600;
      }

      .native-error button:focus-visible {
        border-radius: 4px;
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class App {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  protected readonly externalLinkError = signal<string | null>(null);
  protected readonly isOffline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  private readonly updateNetworkStatus = (): void => {
    this.isOffline.set(!navigator.onLine);
  };
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.updateNetworkStatus);
      window.addEventListener('offline', this.updateNetworkStatus);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('online', this.updateNetworkStatus);
        window.removeEventListener('offline', this.updateNetworkStatus);
      });
    }

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void import('@capacitor/app')
      .then(({ App: CapacitorApp }) => {
        const urlListener = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
          void this.handleAuthDeepLink(url);
        });
        const backListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (this.closeTopmostOverlay()) {
            return;
          }
          if (canGoBack) {
            window.history.back();
          } else {
            void CapacitorApp.minimizeApp().catch(() => {
              console.error('Não foi possível minimizar o aplicativo.');
            });
          }
        });

        void CapacitorApp.getLaunchUrl()
          .then((launch) => {
            if (launch?.url) {
              void this.handleAuthDeepLink(launch.url);
            }
          })
          .catch(() => {
            console.error('Não foi possível verificar o link de inicialização do aplicativo.');
          });

        this.destroyRef.onDestroy(() => {
          void urlListener.then((listener) => listener.remove());
          void backListener.then((listener) => listener.remove());
        });
      })
      .catch(() => {
        console.error('Não foi possível inicializar os recursos nativos do aplicativo.');
      });
  }

  protected handleExternalLink(event: MouseEvent): void {
    if (!Capacitor.isNativePlatform() || !(event.target instanceof Element)) {
      return;
    }

    const anchor = event.target.closest<HTMLAnchorElement>('a[target="_blank"]');
    if (!anchor) {
      return;
    }

    const url = new URL(anchor.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return;
    }

    event.preventDefault();
    this.externalLinkError.set(null);
    void import('@capacitor/browser')
      .then(({ Browser }) => Browser.open({ url: url.toString() }))
      .catch(() => {
        this.externalLinkError.set('Não foi possível abrir este link externo. Tente novamente.');
      });
  }

  private async handleAuthDeepLink(value: string): Promise<void> {
    let callbackUrl: URL;
    try {
      callbackUrl = new URL(value);
    } catch {
      return;
    }

    if (
      callbackUrl.protocol !== 'casalapp:' ||
      callbackUrl.hostname !== 'auth' ||
      callbackUrl.pathname !== '/callback'
    ) {
      return;
    }

    try {
      const next = await this.auth.completeAuthCallback(callbackUrl.toString());
      await this.router.navigateByUrl(next);
    } catch {
      await this.router.navigate(['/auth/callback'], { queryParams: { error: '1' } });
    }
  }

  private closeTopmostOverlay(): boolean {
    const sheet = document.querySelector<HTMLElement>('.sheet-backdrop');
    if (sheet) {
      sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    }

    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog) {
      dialog.close();
      return true;
    }

    return false;
  }

  protected readonly showTabBar = computed(() => {
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    return !['/entrar', '/cadastro', '/espaco'].includes(path);
  });
}
