import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TabBarComponent } from './shared/ui/tab-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <router-outlet />
    </main>
    <app-tab-bar />
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
export class App {}