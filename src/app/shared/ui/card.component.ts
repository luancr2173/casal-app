import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  styles: [
    `
      :host {
        display: block;
        padding: 20px;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        box-shadow: var(--shadow);
      }
    `,
  ],
})
export class CardComponent {}
