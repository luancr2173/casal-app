import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';

@Component({
  selector: 'app-placeholder-page',
  imports: [ButtonComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page__header">
        <h1>{{ title() }}</h1>
        <p>{{ subtitle() }}</p>
      </header>
      <app-card>
        <h2>Feito para vocês</h2>
        <p>Guardem ideias e planejem momentos especiais juntos.</p>
        <app-button>Começar</app-button>
      </app-card>
    </section>
  `,
  styles: [
    `
      .page {
        padding-top: 32px;
      }

      .page__header {
        margin-bottom: 28px;
      }

      .page__header p {
        margin: 8px 0 0;
        font-size: 17px;
        line-height: 1.45;
      }

      app-card h2 {
        margin-bottom: 8px;
      }

      app-card p {
        margin: 0 0 20px;
        line-height: 1.5;
      }
    `,
  ],
})
export class PlaceholderPage {
  readonly title = input('');
  readonly subtitle = input('');
}
