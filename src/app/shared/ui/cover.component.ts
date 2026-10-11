import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cover" [class.cover--small]="size() === 'small'">
      @if (src() && !failed()) {
        <img
          [src]="src()"
          [alt]="title()"
          [class.cover__image--loaded]="imageLoaded()"
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          (load)="imageLoaded.set(true)"
          (error)="failed.set(true)"
        />
      } @else {
        <span aria-hidden="true">{{ initial() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .cover {
        position: relative;
        display: grid;
        width: 72px;
        aspect-ratio: 2 / 3;
        flex: 0 0 auto;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) * 0.55);
        background: var(--fill);
        color: var(--text-secondary);
        box-shadow: var(--shadow-small);
        font-size: 28px;
        font-weight: 600;
      }

      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity var(--dur) var(--ease-out);
      }

      img.cover__image--loaded {
        opacity: 1;
      }

      .cover--small {
        width: 42px;
        border-radius: 7px;
        font-size: 18px;
      }

      @media (max-width: 420px) {
        .cover:not(.cover--small) {
          width: 60px;
        }
      }
    `,
  ],
})
export class CoverComponent {
  readonly title = input.required<string>();
  readonly src = input<string | null>(null);
  readonly size = input<'small' | undefined>();
  protected readonly failed = signal(false);
  protected readonly imageLoaded = signal(false);
  protected readonly initial = () =>
    this.title().trim().charAt(0).toLocaleUpperCase() || 'F';

  constructor() {
    effect(() => {
      this.src();
      this.failed.set(false);
      this.imageLoaded.set(false);
    });
  }
}
