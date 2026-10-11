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
        transition:
          transform var(--dur) var(--ease-out),
          box-shadow var(--dur) var(--ease-out),
          background-color var(--dur) var(--ease-out),
          border-color var(--dur) var(--ease-out);
      }

      @media (hover: hover) and (prefers-reduced-motion: no-preference) {
        :host(:hover) {
          transform: translateY(-1px);
        }
      }
    `,
  ],
})
export class CardComponent {}
