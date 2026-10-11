import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CoupleService } from '../../core/couple.service';

@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tab-bar glass" aria-label="Navegação principal">
      <div class="tab-bar__items">
        @for (tab of tabs; track tab.path) {
          <a
            class="tab-bar__link"
            [routerLink]="tab.path"
            routerLinkActive="tab-bar__link--active"
            [routerLinkActiveOptions]="{ exact: true }"
            ariaCurrentWhenActive="page"
          >
            @if (tab.icon === 'profile' && couplePhotoUrl()) {
              <img
                class="tab-bar__avatar"
                [src]="couplePhotoUrl()"
                alt=""
                aria-hidden="true"
                (error)="couplePhotoUrl.set(null)"
              />
            } @else {
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                @switch (tab.icon) {
                  @case ('home') {
                    <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
                  }
                  @case ('film') {
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
                  }
                  @case ('places') {
                    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  }
                  @case ('profile') {
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                  }
                }
              </svg>
            }
            <span>{{ tab.label }}</span>
          </a>
        }
      </div>
    </nav>
  `,
  styles: [
    `
      .tab-bar {
        position: fixed;
        z-index: 10;
        right: 0;
        bottom: 0;
        left: 0;
        padding: 10px 20px calc(10px + env(safe-area-inset-bottom));
        border-top: 1px solid var(--border);
        view-transition-name: tab-bar;
      }

      .tab-bar__items {
        display: flex;
        max-width: 720px;
        margin: 0 auto;
        justify-content: space-around;
      }

      .tab-bar__link {
        display: flex;
        min-width: 64px;
        min-height: 44px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        color: var(--text-secondary);
        font-size: 11px;
        text-decoration: none;
        transition: color var(--dur-fast) var(--ease-out);
      }

      .tab-bar__link svg {
        width: 22px;
        height: 22px;
        transition: transform var(--dur-fast) var(--ease-ios);
      }

      .tab-bar__avatar {
        width: 24px;
        height: 24px;
        border: 1px solid var(--border);
        border-radius: 50%;
        object-fit: cover;
        transition:
          border-color var(--dur-fast) var(--ease-out),
          transform var(--dur-fast) var(--ease-ios);
      }

      .tab-bar__link--active {
        color: var(--accent);
      }

      .tab-bar__link--active svg {
        transform: scale(1.06);
      }

      .tab-bar__link--active .tab-bar__avatar {
        border-color: var(--accent);
        transform: scale(1.06);
      }

      .tab-bar__link:focus-visible {
        border-radius: 8px;
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class TabBarComponent {
  private readonly couples = inject(CoupleService);
  private readonly destroyRef = inject(DestroyRef);
  private photoRequest = 0;
  private renewalTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly couplePhotoUrl = signal<string | null>(null);

  protected readonly tabs = [
    { path: '/inicio', label: 'Início', icon: 'home' },
    { path: '/filmes', label: 'Filmes', icon: 'film' },
    { path: '/lugares', label: 'Lugares', icon: 'places' },
    { path: '/perfil', label: 'Perfil', icon: 'profile' },
  ] as const;

  constructor() {
    effect(() => {
      const path = this.couples.couple()?.photo_path;
      const request = ++this.photoRequest;
      this.couplePhotoUrl.set(null);
      if (this.renewalTimer) {
        clearInterval(this.renewalTimer);
        this.renewalTimer = null;
      }
      if (!path) {
        return;
      }

      void this.loadCouplePhoto(path, request);
      this.renewalTimer = setInterval(() => {
        void this.loadCouplePhoto(path, request);
      }, 45 * 60 * 1000);
    });

    this.destroyRef.onDestroy(() => {
      if (this.renewalTimer) {
        clearInterval(this.renewalTimer);
      }
    });
  }

  private async loadCouplePhoto(path: string, request: number): Promise<void> {
    try {
      const url = await this.couples.signedPhotoUrl(path);
      if (request === this.photoRequest) {
        this.couplePhotoUrl.set(url);
      }
    } catch {
      if (request === this.photoRequest) {
        this.couplePhotoUrl.set(null);
      }
    }
  }
}
