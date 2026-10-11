import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const lightThemeColor = '#f5f5f7';
const darkThemeColor = '#000000';
const storageKey = 'theme';

function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly mediaQuery =
    typeof window === 'undefined'
      ? null
      : window.matchMedia('(prefers-color-scheme: dark)');
  private switchTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly mode = signal<ThemeMode>(readMode());
  readonly systemDark = signal(this.mediaQuery?.matches ?? false);
  readonly effective = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    return mode === 'system' ? (this.systemDark() ? 'dark' : 'light') : mode;
  });

  private readonly onSystemThemeChange = (event: MediaQueryListEvent): void => {
    this.systemDark.set(event.matches);
    if (this.mode() === 'system') {
      this.animateThemeSwitch();
    }
  };

  constructor() {
    this.mediaQuery?.addEventListener('change', this.onSystemThemeChange);
    this.syncDocument();
    this.destroyRef.onDestroy(() => {
      this.mediaQuery?.removeEventListener('change', this.onSystemThemeChange);
      if (this.switchTimeout) {
        clearTimeout(this.switchTimeout);
      }
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      if (mode === 'system') {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, mode);
      }
    } catch {
      // The current page still applies the selected mode if storage is unavailable.
    }

    this.syncDocument();
    this.animateThemeSwitch();
  }

  private syncDocument(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const mode = this.mode();
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      this.restoreSystemThemeColors();
      return;
    }

    root.dataset['theme'] = mode;
    const color = mode === 'dark' ? darkThemeColor : lightThemeColor;
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((tag) => tag.remove());
    document.head.append(meta);
  }

  private restoreSystemThemeColors(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const existing = document.head.querySelectorAll('meta[name="theme-color"]');
    const hasSystemColors =
      existing.length === 2 &&
      [...existing].some((tag) => tag.getAttribute('media') === '(prefers-color-scheme: light)') &&
      [...existing].some((tag) => tag.getAttribute('media') === '(prefers-color-scheme: dark)');
    if (hasSystemColors) {
      return;
    }

    existing.forEach((tag) => tag.remove());
    for (const [media, content] of [
      ['(prefers-color-scheme: light)', lightThemeColor],
      ['(prefers-color-scheme: dark)', darkThemeColor],
    ]) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = content;
      meta.media = media;
      document.head.append(meta);
    }
  }

  private animateThemeSwitch(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.classList.add('theme-switching');
    if (this.switchTimeout) {
      clearTimeout(this.switchTimeout);
    }
    this.switchTimeout = setTimeout(() => {
      root.classList.remove('theme-switching');
      this.switchTimeout = null;
    }, 300);
  }
}
