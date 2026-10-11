import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, startWith } from 'rxjs';
import type { ItemStatus, ListItem } from '../core/models';
import { CoupleService } from '../core/couple.service';
import {
  MOVIE_SEARCH_PROVIDER,
  type SearchResult,
} from '../core/movie-search';
import { ItemsService } from '../core/items.service';
import { AuthService } from '../core/auth.service';
import { CoverService } from '../core/cover.service';
import { ButtonComponent } from '../shared/ui/button.component';
import { CardComponent } from '../shared/ui/card.component';
import { CoverComponent } from '../shared/ui/cover.component';
import { CoverPickerComponent, type CoverSelection } from '../shared/ui/cover-picker.component';
import { InputComponent } from '../shared/ui/input.component';
import { SheetComponent } from '../shared/ui/sheet.component';

interface BufferedChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  item?: ListItem;
  id?: string;
}

function itemYear(item: ListItem): number | null {
  const year = item.metadata['year'];
  return typeof year === 'number' ? year : null;
}

function normalizedTitle(title: string): string {
  return title.trim().toLocaleLowerCase();
}

function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

@Component({
  selector: 'app-movies-page',
  imports: [
    DatePipe,
    DragDropModule,
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    CoverComponent,
    CoverPickerComponent,
    InputComponent,
    SheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="movies-page">
      <header class="page-header">
        <h1>Filmes</h1>
        <p>Uma lista de histórias para assistir juntos.</p>
      </header>

      <div class="search-area">
        <app-input
          label="Buscar um filme"
          placeholder="Digite o título de um filme"
          autocomplete="off"
          [formControl]="searchControl"
        />
        @if (searching()) {
          <p class="search-status" role="status" aria-live="polite">Buscando…</p>
        } @else if (searchResults().length) {
          <div class="search-results" aria-label="Resultados da busca">
            @for (result of searchResults(); track result.external_id ?? result.title) {
              <article class="search-result">
                <app-cover [title]="result.title" [src]="result.image_url" size="small" />
                <div class="search-result__details">
                  <strong>{{ result.title }}</strong>
                  @if (result.year) {
                    <span>{{ result.year }}</span>
                  }
                </div>
                <button
                  class="icon-button add-result"
                  type="button"
                  [attr.aria-label]="'Adicionar ' + result.title"
                  (click)="addSearchResult(result)"
                >
                  <span aria-hidden="true">+</span>
                </button>
              </article>
            }
          </div>
        } @else if (searchReady() && searchControl.value.trim().length >= 2) {
          <button class="manual-result" type="button" (click)="openManualSheet()">
            <span aria-hidden="true">＋</span>
            <span>Adicionar “{{ searchControl.value.trim() }}”</span>
          </button>
        }
        @if (searchError()) {
          <p class="message" role="alert" aria-live="polite">{{ searchError() }}</p>
        }
      </div>

      @if (error()) {
        <p class="message" role="alert" aria-live="polite">{{ error() }}</p>
      }
      @if (covers.signingError()) {
        <p class="message" role="alert" aria-live="polite">{{ covers.signingError() }}</p>
      }

      <section class="list-section" aria-labelledby="pending-title">
        <div class="section-heading">
          <h2 id="pending-title">Para assistir</h2>
          @if (!loading()) {
            <span class="count">{{ pendingItems().length }}</span>
          }
        </div>

        @if (loading()) {
          <div class="skeleton-list" aria-label="Carregando filmes" role="status">
            @for (skeleton of skeletons; track skeleton) {
              <app-card>
                <div class="skeleton-card">
                  <span class="skeleton-poster"></span>
                  <span class="skeleton-line"></span>
                  <span class="skeleton-line skeleton-line--short"></span>
                </div>
              </app-card>
            }
          </div>
        } @else if (pendingItems().length) {
          <div
            class="movie-list"
            cdkDropList
            [cdkDropListData]="pendingItems()"
            [cdkDropListDisabled]="reordering()"
            (cdkDropListDropped)="drop($event)"
            aria-label="Filmes para assistir. Arraste pela alça para reordenar."
          >
            @for (item of pendingItems(); track item.id) {
              <app-card cdkDrag [cdkDragData]="item" [cdkDragPreviewClass]="'movie-drag-preview'">
                <article class="movie-card">
                  <button
                    class="drag-handle"
                    type="button"
                    cdkDragHandle
                    [attr.aria-label]="'Reordenar ' + item.title"
                    title="Arraste para reordenar"
                  >
                    <span aria-hidden="true">≡</span>
                  </button>
                  <button
                    class="status-check"
                    type="button"
                    role="checkbox"
                    aria-checked="false"
                    [attr.aria-label]="'Marcar ' + item.title + ' como assistido'"
                    (click)="toggleStatus(item)"
                  ></button>
                  <button
                    class="cover-action"
                    type="button"
                    [attr.aria-label]="'Alterar capa de ' + item.title"
                    (click)="openCoverEditor(item)"
                  >
                    <app-cover [title]="item.title" [src]="coverUrl(item)" />
                  </button>
                  <div class="movie-card__details">
                    <h3>{{ item.title }}</h3>
                    @if (itemYear(item); as year) {
                      <p>{{ year }}</p>
                    }
                    @if (itemNote(item); as note) {
                      <p class="movie-note">{{ note }}</p>
                    }
                    <p class="added-by">{{ addedBy(item) }}</p>
                  </div>
                  <button
                    class="icon-button remove-button"
                    type="button"
                    [attr.aria-label]="confirmRemoveId() === item.id ? 'Cancelar remoção de ' + item.title : 'Remover ' + item.title"
                    (click)="toggleRemoveConfirmation(item.id)"
                  >
                    <span aria-hidden="true">{{ confirmRemoveId() === item.id ? '×' : '…' }}</span>
                  </button>
                  @if (confirmRemoveId() === item.id) {
                    <div class="remove-confirm" role="group" [attr.aria-label]="'Confirmar remoção de ' + item.title">
                      <span>Remover este filme?</span>
                      <button type="button" (click)="remove(item)">Remover</button>
                      <button type="button" (click)="toggleRemoveConfirmation(null)">Cancelar</button>
                    </div>
                  }
                </article>
              </app-card>
            }
          </div>
        } @else {
          <app-card>
            <div class="empty-state">
              <h3>Sua próxima noite de cinema começa aqui</h3>
              <p>Busque um filme acima para adicioná-lo à lista de vocês.</p>
            </div>
          </app-card>
        }
      </section>

      @if (watchedItems().length) {
        <section class="list-section" aria-labelledby="watched-title">
          <div class="section-heading">
            <h2 id="watched-title">Assistidos</h2>
            <span class="count">{{ watchedItems().length }}</span>
          </div>
          <div class="movie-list movie-list--watched">
            @for (item of watchedItems(); track item.id) {
              <app-card>
                <article class="movie-card movie-card--watched">
                  <button
                    class="status-check status-check--done"
                    type="button"
                    role="checkbox"
                    aria-checked="true"
                    [attr.aria-label]="'Desmarcar ' + item.title + ' como assistido'"
                    (click)="toggleStatus(item)"
                  >
                    <span aria-hidden="true">✓</span>
                  </button>
                  <button
                    class="cover-action"
                    type="button"
                    [attr.aria-label]="'Alterar capa de ' + item.title"
                    (click)="openCoverEditor(item)"
                  >
                    <app-cover [title]="item.title" [src]="coverUrl(item)" />
                  </button>
                  <div class="movie-card__details">
                    <h3>{{ item.title }}</h3>
                    @if (itemYear(item); as year) {
                      <p>{{ year }}</p>
                    }
                    @if (itemNote(item); as note) {
                      <p class="movie-note">{{ note }}</p>
                    }
                    @if (item.done_at) {
                      <p class="added-by">Assistido {{ item.done_at | date: 'dd/MM/yyyy' }}</p>
                    }
                  </div>
                  <button
                    class="icon-button remove-button"
                    type="button"
                    [attr.aria-label]="confirmRemoveId() === item.id ? 'Cancelar remoção de ' + item.title : 'Remover ' + item.title"
                    (click)="toggleRemoveConfirmation(item.id)"
                  >
                    <span aria-hidden="true">{{ confirmRemoveId() === item.id ? '×' : '…' }}</span>
                  </button>
                  @if (confirmRemoveId() === item.id) {
                    <div class="remove-confirm" role="group" [attr.aria-label]="'Confirmar remoção de ' + item.title">
                      <span>Remover este filme?</span>
                      <button type="button" (click)="remove(item)">Remover</button>
                      <button type="button" (click)="toggleRemoveConfirmation(null)">Cancelar</button>
                    </div>
                  }
                </article>
              </app-card>
            }
          </div>
        </section>
      }
    </section>

    <app-sheet [open]="sheetOpen()" title="Adicionar filme" (closed)="closeManualSheet()">
      <form class="manual-form" [formGroup]="manualForm" (ngSubmit)="addManual()" novalidate>
        <app-input
          label="Título"
          placeholder="Nome do filme"
          formControlName="title"
          [error]="titleError()"
        />
        <app-input
          label="Ano (opcional)"
          type="text"
          placeholder="AAAA"
          formControlName="year"
          [error]="yearError()"
        />
        <app-input
          label="Observação (opcional)"
          placeholder="Uma nota para vocês"
          formControlName="note"
          [error]="null"
        />
        <app-cover-picker
          [currentSrc]="null"
          [resetToken]="manualPickerReset()"
          (changed)="newCover.set($event)"
          (valid)="newCoverValid.set($event)"
        />
        @if (duplicateMessage()) {
          <p class="message" role="alert" aria-live="polite">{{ duplicateMessage() }}</p>
        }
        <app-button type="submit" [disabled]="saving() || !newCoverValid()">
          {{ saving() ? 'Adicionando…' : 'Adicionar à lista' }}
        </app-button>
      </form>
    </app-sheet>

    <app-sheet
      [open]="!!coverEditItem()"
      title="Alterar capa"
      (closed)="closeCoverEditor()"
    >
      @if (coverEditItem(); as item) {
        <div class="manual-form">
          <app-cover-picker
            [currentSrc]="coverUrl(item)"
            [resetToken]="editPickerReset()"
            (changed)="editCover.set($event)"
            (valid)="editCoverValid.set($event)"
          />
          <app-button
            [disabled]="saving() || !editCoverValid()"
            (click)="saveCoverEdit(item)"
          >
            {{ saving() ? 'Salvando…' : 'Salvar capa' }}
          </app-button>
        </div>
      }
    </app-sheet>
  `,
  styles: [
    `
      .movies-page {
        display: grid;
        gap: 32px;
        padding: 32px 0 calc(24px + env(safe-area-inset-bottom));
      }

      .page-header p {
        margin: 8px 0 0;
        font-size: 17px;
        line-height: 1.45;
      }

      .search-area {
        display: grid;
        gap: 12px;
      }

      .search-status,
      .message {
        margin: 0;
      }

      .message {
        color: var(--text-secondary);
      }

      .manual-result {
        display: flex;
        min-height: 52px;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .manual-result:focus-visible,
      .icon-button:focus-visible,
      .status-check:focus-visible,
      .drag-handle:focus-visible,
      .remove-confirm button:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .search-results,
      .movie-list,
      .skeleton-list {
        display: grid;
        gap: 12px;
      }

      .search-result {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .search-result__details {
        display: grid;
        flex: 1;
        gap: 4px;
      }

      .cover-action {
        display: grid;
        min-width: 44px;
        min-height: 44px;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: 10px;
        background: transparent;
        cursor: pointer;
      }

      .cover-action:focus-visible {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
      }

      .icon-button {
        display: grid;
        width: 44px;
        height: 44px;
        flex: 0 0 auto;
        place-items: center;
        border: 0;
        border-radius: 50%;
        background: var(--fill);
        color: var(--text);
        font: inherit;
        cursor: pointer;
      }

      .add-result {
        background: var(--accent);
        color: var(--accent-text);
        font-size: 26px;
      }

      .list-section {
        display: grid;
        gap: 16px;
      }

      .section-heading {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .count {
        color: var(--text-secondary);
        font-size: 13px;
      }

      .movie-card {
        position: relative;
        display: grid;
        grid-template-columns: 36px 34px 72px minmax(0, 1fr) 44px;
        align-items: center;
        gap: 10px;
        min-height: 128px;
        animation: movie-in 180ms ease both;
      }

      .drag-handle,
      .status-check {
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border: 0;
        background: transparent;
        color: var(--text-secondary);
        cursor: grab;
      }

      .drag-handle {
        font-size: 28px;
        letter-spacing: -5px;
      }

      .status-check {
        width: 30px;
        height: 30px;
        border: 2px solid var(--border);
        border-radius: 50%;
        cursor: pointer;
      }

      .status-check--done {
        border-color: var(--accent);
        background: var(--accent);
        color: var(--accent-text);
        font-size: 17px;
      }

      .movie-card__details {
        min-width: 0;
      }

      .movie-card__details h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .movie-card__details p {
        margin: 5px 0 0;
        font-size: 13px;
      }

      .movie-card--watched {
        grid-template-columns: 34px 72px minmax(0, 1fr) 44px;
        opacity: 0.8;
      }

      .remove-button {
        align-self: start;
      }

      .remove-confirm {
        position: absolute;
        z-index: 2;
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        min-height: 52px;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 6px 10px;
        border-radius: 10px;
        background: var(--surface);
        box-shadow: var(--shadow);
        font-size: 13px;
      }

      .remove-confirm span {
        margin-right: auto;
      }

      .remove-confirm button {
        min-height: 44px;
        padding: 0 8px;
        border: 0;
        background: transparent;
        color: var(--accent);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .empty-state {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 20px 4px;
        text-align: center;
      }

      .empty-state h3,
      .empty-state p {
        margin: 0;
      }

      .empty-state p {
        line-height: 1.5;
      }

      .skeleton-card {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 10px;
      }

      .skeleton-poster,
      .skeleton-line {
        border-radius: 8px;
        background: var(--fill);
        animation: pulse 1.3s ease-in-out infinite alternate;
      }

      .skeleton-poster {
        grid-row: span 2;
        width: 72px;
        height: 104px;
      }

      .skeleton-line {
        height: 18px;
        align-self: center;
      }

      .skeleton-line--short {
        width: 60%;
      }

      .manual-form {
        display: grid;
        gap: 20px;
      }

      .cdk-drag-placeholder {
        opacity: 0.25;
      }

      .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
        transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
      }

      @keyframes pulse {
        to {
          opacity: 0.45;
        }
      }

      @keyframes movie-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 420px) {
        .movie-card {
          grid-template-columns: 30px 30px 60px minmax(0, 1fr) 40px;
          gap: 6px;
        }

        .movie-card--watched {
          grid-template-columns: 30px 60px minmax(0, 1fr) 40px;
        }

      }

      @media (prefers-reduced-motion: reduce) {
        .skeleton-poster,
        .skeleton-line {
          animation: none;
        }

        .movie-card {
          animation: none;
        }
      }
    `,
  ],
})
export class MoviesPage {
  private readonly itemsService = inject(ItemsService);
  private readonly couples = inject(CoupleService);
  private readonly auth = inject(AuthService);
  private readonly searchProvider = inject(MOVIE_SEARCH_PROVIDER);
  readonly covers = inject(CoverService);
  private readonly destroyRef = inject(DestroyRef);

  private cancelRealtime?: () => void;
  private activeCoupleId: string | null = null;
  private initialLoadComplete = false;
  private readonly bufferedChanges: BufferedChange[] = [];
  private searchSequence = 0;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly items = signal<ListItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly reordering = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchError = signal<string | null>(null);
  readonly searching = signal(false);
  readonly searchReady = signal(false);
  readonly searchResults = signal<SearchResult[]>([]);
  readonly sheetOpen = signal(false);
  readonly newCover = signal<CoverSelection | null>(null);
  readonly newCoverValid = signal(true);
  readonly manualPickerReset = signal(0);
  readonly coverEditItem = signal<ListItem | null>(null);
  readonly editCover = signal<CoverSelection | null | undefined>(undefined);
  readonly editCoverValid = signal(true);
  readonly editPickerReset = signal(0);
  readonly duplicateMessage = signal<string | null>(null);
  readonly confirmRemoveId = signal<string | null>(null);
  readonly skeletons = [1, 2, 3];
  readonly pendingItems = computed(() =>
    sortItems(this.items().filter((item) => item.status === 'PENDING')),
  );
  readonly watchedItems = computed(() =>
    this.items()
      .filter((item) => item.status === 'DONE')
      .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')),
  );
  readonly manualForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    year: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.pattern(/^\d{4}$/),
        Validators.min(1888),
        Validators.max(new Date().getFullYear() + 5),
      ],
    }),
    note: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        startWith(this.searchControl.value),
        map((query) => query.trim()),
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((query) => void this.search(query));

    this.manualForm.controls.title.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.duplicateMessage.set(null));

    this.destroyRef.onDestroy(() => this.cancelRealtime?.());
    this.destroyRef.onDestroy(() => this.covers.stopRenewal());
    effect(() => {
      const paths = this.items()
        .map((item) => item.metadata.cover_path)
        .filter((path): path is string => typeof path === 'string' && !!path);
      void this.covers.prime(paths).catch(() => {
        return;
      });
    });

    const coupleId = this.couples.couple()?.id;
    if (coupleId) {
      void this.initialize(coupleId);
    }
  }

  itemYear(item: ListItem): number | null {
    return itemYear(item);
  }

  itemNote(item: ListItem): string | null {
    const note = item.metadata['note'];
    return typeof note === 'string' && note.trim() ? note : null;
  }

  initial(title: string): string {
    return title.trim().charAt(0).toLocaleUpperCase() || 'F';
  }

  addedBy(item: ListItem): string {
    if (item.added_by === this.auth.user()?.id) {
      return 'Você';
    }

    const partner = this.couples.partner();
    return partner?.name ?? 'Seu par';
  }

  coverUrl(item: ListItem): string | null {
    return this.covers.urlFor(item);
  }

  openManualSheet(title = this.searchControl.value.trim(), year: number | null = null): void {
    this.manualForm.reset({
      title,
      year: year === null ? '' : String(year),
      note: '',
    });
    this.duplicateMessage.set(null);
    this.newCover.set(null);
    this.newCoverValid.set(true);
    this.manualPickerReset.update((value) => value + 1);
    this.sheetOpen.set(true);
  }

  openCoverEditor(item: ListItem): void {
    this.coverEditItem.set(item);
    this.editCover.set(undefined);
    this.editCoverValid.set(true);
    this.editPickerReset.update((value) => value + 1);
  }

  closeCoverEditor(): void {
    this.coverEditItem.set(null);
    this.editCover.set(undefined);
    this.editCoverValid.set(true);
    this.editPickerReset.update((value) => value + 1);
  }

  closeManualSheet(): void {
    this.sheetOpen.set(false);
    this.newCover.set(null);
    this.newCoverValid.set(true);
    this.manualPickerReset.update((value) => value + 1);
  }

  titleError(): string | null {
    const control = this.manualForm.controls.title;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Informe o título do filme.';
    }
    return control.hasError('maxlength') ? 'O título pode ter no máximo 200 caracteres.' : null;
  }

  yearError(): string | null {
    const control = this.manualForm.controls.year;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('pattern')) {
      return 'Informe o ano com quatro dígitos.';
    }
    if (control.hasError('min')) {
      return 'O ano deve ser 1888 ou posterior.';
    }
    return control.hasError('max')
      ? `O ano deve ser até ${new Date().getFullYear() + 5}.`
      : null;
  }

  async addManual(): Promise<void> {
    this.duplicateMessage.set(null);
    this.manualForm.markAllAsTouched();
    if (this.manualForm.invalid) {
      return;
    }

    const { title, year, note } = this.manualForm.getRawValue();
    const parsedYear = year ? Number(year) : null;
    if (this.isDuplicate(title, parsedYear)) {
      this.duplicateMessage.set('Esse filme já está na lista de vocês.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    let uploadedPath: string | null = null;
    const selectedCover = this.newCover();
    try {
      if (selectedCover?.kind === 'file') {
        uploadedPath = await this.covers.upload(selectedCover.blob);
      }

      const created = await this.itemsService.add({
        type: 'MOVIE',
        title: title.trim(),
        external_id: null,
        image_url: selectedCover?.kind === 'url' ? selectedCover.url : null,
        metadata: {
          year: parsedYear,
          note: note.trim() || null,
          ...(uploadedPath ? { cover_path: uploadedPath } : {}),
        },
      });
      this.upsertItem(created);
      this.finishAdding();
    } catch (error: unknown) {
      if (uploadedPath) {
        await this.covers.remove(uploadedPath);
      }
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async addSearchResult(result: SearchResult): Promise<void> {
    if (this.isDuplicate(result.title, result.year)) {
      this.searchError.set('Esse filme já está na lista de vocês.');
      return;
    }

    this.searchError.set(null);
    this.saving.set(true);
    try {
      const created = await this.itemsService.add({
        type: 'MOVIE',
        title: result.title,
        external_id: result.external_id,
        image_url: result.image_url,
        metadata: { year: result.year, note: null },
      });
      this.upsertItem(created);
      this.finishAdding();
    } catch (error: unknown) {
      this.searchError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async drop(event: CdkDragDrop<ListItem[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const previousItems = this.items();
    const ordered = this.pendingItems();
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);
    const orderedIds = ordered.map((item) => item.id);
    this.items.set(
      sortItems(
        previousItems.map((item) => {
          const position = orderedIds.indexOf(item.id);
          return position >= 0 ? { ...item, position: position + 1 } : item;
        }),
      ),
    );
    this.error.set(null);
    this.reordering.set(true);

    try {
      await this.itemsService.reorder(orderedIds);
    } catch (error: unknown) {
      this.items.set(previousItems);
      this.error.set(this.errorMessage(error));
    } finally {
      this.reordering.set(false);
    }
  }

  async toggleStatus(item: ListItem): Promise<void> {
    const nextStatus: ItemStatus = item.status === 'PENDING' ? 'DONE' : 'PENDING';
    const before = this.items();
    const pendingAtEnd =
      nextStatus === 'PENDING'
        ? [
            ...this.pendingItems().filter((candidate) => candidate.id !== item.id),
            { ...item, status: 'PENDING' as const, done_at: null },
          ]
        : [];
    const optimisticItems = before.map((candidate) =>
      candidate.id === item.id
        ? {
            ...candidate,
            status: nextStatus,
            done_at: nextStatus === 'DONE' ? new Date().toISOString() : null,
            position:
              nextStatus === 'PENDING'
                ? this.pendingItems().length + 1
                : candidate.position,
          }
        : candidate,
    );

    if (nextStatus === 'PENDING') {
      const ids = pendingAtEnd.map((candidate) => candidate.id);
      const positions = new Map(ids.map((id, index) => [id, index + 1]));
      this.items.set(
        optimisticItems.map((candidate) => {
          const position = positions.get(candidate.id);
          return position ? { ...candidate, position } : candidate;
        }),
      );
    } else {
      this.items.set(optimisticItems);
    }

    this.error.set(null);
    try {
      await this.itemsService.setStatus(item.id, nextStatus);
      if (nextStatus === 'PENDING') {
        await this.itemsService.reorder(pendingAtEnd.map((candidate) => candidate.id));
      }
    } catch (error: unknown) {
      if (nextStatus === 'DONE') {
        this.items.set(before);
      } else {
        this.error.set(this.errorMessage(error));
        await this.refreshItems();
      }
      this.error.set(this.errorMessage(error));
    }
  }

  toggleRemoveConfirmation(id: string | null): void {
    this.confirmRemoveId.set(this.confirmRemoveId() === id ? null : id);
  }

  async remove(item: ListItem): Promise<void> {
    const before = this.items();
    this.items.set(before.filter((candidate) => candidate.id !== item.id));
    this.confirmRemoveId.set(null);
    this.error.set(null);

    try {
      await this.itemsService.remove(item.id);
      const coverPath = item.metadata.cover_path;
      if (typeof coverPath === 'string') {
        await this.covers.remove(coverPath);
      }
    } catch (error: unknown) {
      this.items.set(before);
      this.error.set(this.errorMessage(error));
    }
  }

  async saveCoverEdit(item: ListItem): Promise<void> {
    const selection = this.editCover();
    if (selection === undefined) {
      this.closeCoverEditor();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const previousPath = item.metadata.cover_path;
    let uploadedPath: string | null = null;

    try {
      if (selection?.kind === 'file') {
        uploadedPath = await this.covers.upload(selection.blob);
      }

      const metadata = { ...item.metadata };
      if (selection?.kind === 'file' && uploadedPath) {
        metadata['cover_path'] = uploadedPath;
      } else {
        delete metadata['cover_path'];
      }

      const updated = await this.itemsService.update(item.id, {
        image_url: selection?.kind === 'url' ? selection.url : null,
        metadata,
      });
      this.upsertItem(updated);
      this.closeCoverEditor();

      if (
        typeof previousPath === 'string' &&
        previousPath &&
        previousPath !== uploadedPath
      ) {
        await this.covers.remove(previousPath);
      }
    } catch (error: unknown) {
      if (uploadedPath) {
        await this.covers.remove(uploadedPath);
      }
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async search(query: string): Promise<void> {
    const sequence = ++this.searchSequence;
    this.searchResults.set([]);
    this.searchError.set(null);
    this.searchReady.set(false);

    if (query.length < 2) {
      this.searching.set(false);
      return;
    }

    this.searching.set(true);
    try {
      const results = await this.searchProvider.search(query);
      if (sequence === this.searchSequence) {
        this.searchResults.set(results);
        this.searchReady.set(true);
      }
    } catch {
      if (sequence === this.searchSequence) {
        this.searchError.set('Não foi possível buscar agora. Tente novamente.');
      }
    } finally {
      if (sequence === this.searchSequence) {
        this.searching.set(false);
      }
    }
  }

  private async initialize(coupleId: string): Promise<void> {
    if (this.activeCoupleId === coupleId) {
      return;
    }

    this.activeCoupleId = coupleId;
    this.loading.set(true);
    this.initialLoadComplete = false;
    this.bufferedChanges.length = 0;
    this.cancelRealtime?.();
    this.cancelRealtime = this.itemsService.subscribe('MOVIE', coupleId, (change) => {
      if (!this.initialLoadComplete) {
        this.bufferedChanges.push(change);
      } else {
        this.applyChange(change);
      }
    });

    try {
      const items = await this.itemsService.list('MOVIE');
      if (this.destroyRef.destroyed || this.activeCoupleId !== coupleId) {
        return;
      }
      this.items.set(items);
      this.initialLoadComplete = true;
      for (const change of this.bufferedChanges) {
        this.applyChange(change);
      }
      this.bufferedChanges.length = 0;
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
      this.initialLoadComplete = true;
    } finally {
      if (!this.destroyRef.destroyed && this.activeCoupleId === coupleId) {
        this.loading.set(false);
      }
    }
  }

  private applyChange(change: BufferedChange): void {
    if (change.eventType === 'DELETE' && change.id) {
      this.items.update((items) => items.filter((item) => item.id !== change.id));
    } else if (change.item) {
      this.upsertItem(change.item);
    }
  }

  private upsertItem(item: ListItem): void {
    this.items.update((items) => {
      const existingIndex = items.findIndex((candidate) => candidate.id === item.id);
      if (existingIndex === -1) {
        return sortItems([...items, item]);
      }

      return sortItems(items.map((candidate) => (candidate.id === item.id ? item : candidate)));
    });
  }

  private async refreshItems(): Promise<void> {
    try {
      this.items.set(await this.itemsService.list('MOVIE'));
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    }
  }

  private isDuplicate(title: string, year: number | null): boolean {
    return this.items().some(
      (item) => normalizedTitle(item.title) === normalizedTitle(title) && itemYear(item) === year,
    );
  }

  private finishAdding(): void {
    this.sheetOpen.set(false);
    this.newCover.set(null);
    this.newCoverValid.set(true);
    this.manualPickerReset.update((value) => value + 1);
    this.searchControl.setValue('');
    this.searchResults.set([]);
    this.searchReady.set(false);
    this.duplicateMessage.set(null);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error && error.message
      ? error.message
      : 'Não foi possível salvar agora. Tente novamente.';
  }
}
