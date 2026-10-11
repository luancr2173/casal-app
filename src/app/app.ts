import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ThemeService } from './core/theme.service';
import { TabBarComponent } from './shared/ui/tab-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
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
    `,
  ],
})
export class App {
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly showTabBar = computed(() => {
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    return !['/entrar', '/cadastro', '/espaco'].includes(path);
  });
}