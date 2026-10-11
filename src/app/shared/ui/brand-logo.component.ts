import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-brand-logo',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      class="brand-logo"
      ngSrc="/casalapp-logo.png"
      width="1024"
      height="765"
      priority
      alt="Logo do CasalApp"
    />
  `,
  styles: [
    `
      .brand-logo {
        display: block;
        width: 76px;
        height: 76px;
        border: 1px solid var(--border);
        border-radius: 22px;
        background: #0d1b3d;
        box-shadow: var(--shadow-small);
        object-fit: cover;
        object-position: center;
      }
    `,
  ],
})
export class BrandLogoComponent {}
