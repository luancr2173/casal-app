import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormRecord,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, startWith } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CoverService } from '../../core/cover.service';
import { CoupleService } from '../../core/couple.service';
import { ItemsService } from '../../core/items.service';
import type { ItemStatus, ListItem } from '../../core/models';
import { MOVIE_SEARCH_PROVIDER, type SearchResult } from '../../core/movie-search';
import { ButtonComponent } from '../ui/button.component';
import { CardComponent } from '../ui/card.component';
import { CoverComponent } from '../ui/cover.component';
import { CoverPickerComponent, type CoverSelection } from '../ui/cover-picker.component';
import { InputComponent } from '../ui/input.component';
import { SheetComponent } from '../ui/sheet.component';
import type { ItemFormField, ItemListConfig } from './item-list-config';

interface RealtimeChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  item?: ListItem;
  id?: string;
}

function sortByPosition(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => a.position - b.position);
}

@Component({
  selector: 'app-items-list',
  imports: [
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
    <section class="items-page">
      <header class="page-header">
        <h1>{{ config().title }}</h1>
        <p>{{ config().subtitle }}</p>
      </header>

      @if (config().searchProvider) {
        <div class="search-area">
          <app-input
            label="Buscar um filme"
            placeholder="Digite o título de um filme"
            autocomplete="off"
            [formControl]="searchControl"
          />
          @if (searching()) {
            <p role="status" aria-live="polite">Buscando…</p>
          } @else if (availableSearchResults().length) {
            <div class="search-results" aria-live="polite" aria-label="Sugestões de filmes">
              <h2>Sugestões</h2>
              @for (result of availableSearchResults(); track searchResultKey(result)) {
                <article class="search-result">
                  <app-cover [title]="result.title" [src]="result.image_url" size="small" />
                  <div class="search-result__details">
                    <strong>{{ result.title }}</strong>
                    @if (result.year) {
                      <span>{{ result.year }}</span>
                    }
                    @if (result.genres?.length) {
                      <span>{{ result.genres?.join(' · ') }}</span>
                    }
                    @if (result.overview) {
                      <p>{{ result.overview }}</p>
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
            @if (searchResults().length) {
              <p class="search-feedback" role="status" aria-live="polite">
                Os títulos encontrados já estão na lista de vocês.
              </p>
            } @else {
              <p class="search-feedback" role="status" aria-live="polite">
                Não encontramos sugestões. Você pode adicionar o filme manualmente.
              </p>
            }
            <button class="manual-result" type="button" (click)="openAddSheet()">
              <span aria-hidden="true">＋</span>
              <span>Adicionar “{{ searchControl.value.trim() }}” manualmente</span>
            </button>
          }
          @if (searchError()) {
            <p class="search-feedback" role="alert" aria-live="polite">{{ searchError() }}</p>
          }
        </div>
      } @else {
        <app-button (click)="openAddSheet()">{{ config().addButtonLabel }}</app-button>
      }

      @if (error()) {
        <p class="message" role="alert" aria-live="polite" animate.enter="message-enter">{{ error() }}</p>
      }
      @if (covers.signingError()) {
        <p class="message" role="alert" aria-live="polite" animate.enter="message-enter">{{ covers.signingError() }}</p>
      }

      <section class="list-section" aria-labelledby="pending-title">
        <div class="section-heading">
          <h2 id="pending-title">{{ config().pendingLabel }}</h2>
          @if (!loading()) {
            <span class="count">{{ pendingItems().length }}</span>
          }
        </div>
        @if (loading()) {
          <div class="skeleton-list" aria-label="Carregando lista" role="status">
            @for (skeleton of skeletons; track skeleton) {
              <app-card animate.enter="item-enter" animate.leave="item-leave">
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
            class="item-list"
            cdkDropList
            [cdkDropListData]="pendingItems()"
            [cdkDropListDisabled]="reordering()"
            (cdkDropListDropped)="drop($event)"
            [attr.aria-label]="config().pendingLabel + '. Arraste pela alça para reordenar.'"
          >
            @for (item of pendingItems(); track item.id) {
              <app-card
                cdkDrag
                [cdkDragData]="item"
                animate.enter="item-enter"
                animate.leave="item-leave"
              >
                <article
                  class="item-card"
                  [class.item-card--place]="config().type === 'PLACE'"
                  [attr.tabindex]="config().type === 'PLACE' ? 0 : null"
                  [attr.aria-label]="config().type === 'PLACE' ? 'Editar ' + item.title : null"
                  (click)="editOnCard(item)"
                  (keydown.enter)="editOnCard(item)"
                >
                  <button
                    class="drag-handle"
                    type="button"
                    cdkDragHandle
                    [attr.aria-label]="'Reordenar ' + item.title"
                    title="Arraste para reordenar"
                    (click)="$event.stopPropagation()"
                  >
                    <span aria-hidden="true">≡</span>
                  </button>
                  <button
                    class="status-check"
                    [class.status-check--done]="false"
                    type="button"
                    role="checkbox"
                    aria-checked="false"
                    [attr.aria-label]="'Marcar ' + item.title + ' como ' + config().doneVerb"
                    (click)="toggleStatus(item); $event.stopPropagation()"
                  ></button>
                  <button
                    class="cover-action"
                    type="button"
                    [attr.aria-label]="'Alterar capa de ' + item.title"
                    (click)="openCoverEditor(item); $event.stopPropagation()"
                  >
                    <app-cover [title]="item.title" [src]="coverUrl(item)" />
                  </button>
                  <div class="item-card__details">
                    <button
                      class="item-title"
                      type="button"
                      (click)="openEdit(item); $event.stopPropagation()"
                    >
                      {{ item.title }}
                    </button>
                    @for (subtitle of config().cardSubtitles(item); track $index) {
                      <p>{{ subtitle }}</p>
                    }
                    <p class="added-by">{{ addedBy(item) }}</p>
                    @if (config().type === 'PLACE') {
                      <div class="item-links">
                        @if (placeLink(item); as link) {
                          <a
                            [href]="link"
                            target="_blank"
                            rel="noopener noreferrer"
                            (click)="$event.stopPropagation()"
                          >Abrir link</a>
                        }
                        <a
                          [href]="mapUrl(item)"
                          target="_blank"
                          rel="noopener noreferrer"
                          (click)="$event.stopPropagation()"
                        >Ver no mapa</a>
                      </div>
                    }
                    @if (config().type === 'MOVIE' && trailerVideoId(item); as videoId) {
                      <a
                        class="trailer-preview"
                        [href]="trailerUrl(item)"
                        target="_blank"
                        rel="noopener noreferrer"
                        [attr.aria-label]="'Assistir trailer de ' + item.title + ' no YouTube'"
                      >
                        <img
                          [src]="trailerThumbnail(videoId)"
                          [alt]="'Prévia do trailer de ' + item.title"
                          loading="lazy"
                          decoding="async"
                        />
                        <span><span aria-hidden="true">▶</span> Assistir trailer</span>
                      </a>
                    }
                  </div>
                  <button
                    class="icon-button remove-button"
                    type="button"
                    [attr.aria-label]="confirmRemoveId() === item.id ? 'Cancelar remoção de ' + item.title : 'Remover ' + item.title"
                    (click)="toggleRemoveConfirmation(item.id); $event.stopPropagation()"
                  >
                    <span aria-hidden="true">{{ confirmRemoveId() === item.id ? '×' : '…' }}</span>
                  </button>
                  @if (confirmRemoveId() === item.id) {
                    <div
                      class="remove-confirm"
                      role="group"
                      [attr.aria-label]="'Confirmar remoção de ' + item.title"
                      (click)="$event.stopPropagation()"
                    >
                      <span>Remover este item?</span>
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
              <h3>{{ config().emptyTitle }}</h3>
              <p>{{ config().emptyText }}</p>
            </div>
          </app-card>
        }
      </section>

      @if (watchedItems().length) {
        <section class="list-section" aria-labelledby="done-title">
          <div class="section-heading">
            <h2 id="done-title">{{ config().doneLabel }}</h2>
            <span class="count">{{ watchedItems().length }}</span>
          </div>
          <div class="item-list item-list--done">
            @for (item of watchedItems(); track item.id) {
              <app-card>
                <article
                  class="item-card item-card--done"
                  [class.item-card--place]="config().type === 'PLACE'"
                >
                  <button
                    class="status-check status-check--done"
                    type="button"
                    role="checkbox"
                    aria-checked="true"
                    [attr.aria-label]="'Desmarcar ' + item.title + ' como ' + config().doneVerb"
                    (click)="toggleStatus(item); $event.stopPropagation()"
                  ><span aria-hidden="true">✓</span></button>
                  <button
                    class="cover-action"
                    type="button"
                    [attr.aria-label]="'Alterar capa de ' + item.title"
                    (click)="openCoverEditor(item); $event.stopPropagation()"
                  >
                    <app-cover [title]="item.title" [src]="coverUrl(item)" />
                  </button>
                  <div class="item-card__details">
                    <button class="item-title" type="button" (click)="openEdit(item)">
                      {{ item.title }}
                    </button>
                    @for (subtitle of config().cardSubtitles(item); track $index) {
                      <p>{{ subtitle }}</p>
                    }
                    <p class="added-by">{{ addedBy(item) }}</p>
                    @if (item.done_at) {
                      <p class="added-by">{{ doneDate(item.done_at) }}</p>
                    }
                    @if (config().type === 'PLACE') {
                      <div class="item-links">
                        @if (placeLink(item); as link) {
                          <a [href]="link" target="_blank" rel="noopener noreferrer">Abrir link</a>
                        }
                        <a [href]="mapUrl(item)" target="_blank" rel="noopener noreferrer">Ver no mapa</a>
                      </div>
                    }
                    @if (config().type === 'MOVIE' && trailerVideoId(item); as videoId) {
                      <a
                        class="trailer-preview"
                        [href]="trailerUrl(item)"
                        target="_blank"
                        rel="noopener noreferrer"
                        [attr.aria-label]="'Assistir trailer de ' + item.title + ' no YouTube'"
                      >
                        <img
                          [src]="trailerThumbnail(videoId)"
                          [alt]="'Prévia do trailer de ' + item.title"
                          loading="lazy"
                          decoding="async"
                        />
                        <span><span aria-hidden="true">▶</span> Assistir trailer</span>
                      </a>
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
                    <div class="remove-confirm" role="group">
                      <span>Remover este item?</span>
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

    <app-sheet
      [open]="formSheetOpen()"
      [title]="editingItem() ? 'Editar ' + config().title.toLocaleLowerCase() : config().formTitle"
      (closed)="closeFormSheet()"
    >
      <form class="item-form" [formGroup]="form" (ngSubmit)="saveForm()" novalidate>
        @for (field of config().formFields; track field.key) {
          @if (field.kind === 'category') {
            <fieldset class="category-field">
              <legend>{{ field.label }}</legend>
              <div class="segmented" role="group" [attr.aria-label]="field.label">
                @for (option of field.options ?? []; track option) {
                  <button
                    type="button"
                    [class.segmented__option--active]="form.controls[field.key].value === option"
                    [attr.aria-pressed]="form.controls[field.key].value === option"
                    (click)="form.controls[field.key].setValue(option)"
                  >
                    {{ option }}
                  </button>
                }
              </div>
            </fieldset>
          } @else {
            <app-input
              [label]="field.label"
              [type]="field.kind === 'url' ? 'url' : 'text'"
              [placeholder]="field.placeholder ?? ''"
              [autocomplete]="field.kind === 'url' ? 'url' : 'off'"
              [formControl]="form.controls[field.key]"
              [error]="fieldError(field)"
            />
          }
        }
        @if (config().type === 'MOVIE') {
          <app-input
            label="Trailer do YouTube (opcional)"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            autocomplete="url"
            [formControl]="trailerControl"
            [error]="trailerError()"
            (input)="trailerError.set(null)"
          />
        }
        @if (formError()) {
          <p class="message" role="alert" aria-live="polite">{{ formError() }}</p>
        }
        <app-cover-picker
          [currentSrc]="editingItem() ? coverUrl(editingItem()!) : null"
          [resetToken]="pickerReset()"
          (changed)="selectedCover.set($event)"
          (valid)="coverValid.set($event)"
        />
        @if (duplicateError()) {
          <p class="message" role="alert" aria-live="polite">{{ duplicateError() }}</p>
        }
        <app-button type="submit" [disabled]="saving() || !coverValid()">
          {{ saving() ? 'Salvando…' : editingItem() ? 'Salvar alterações' : config().addButtonLabel }}
        </app-button>
      </form>
    </app-sheet>

    <app-sheet [open]="!!coverEditItem()" title="Alterar capa" (closed)="closeCoverEditor()">
      @if (coverEditItem(); as item) {
        <div class="item-form">
          <app-cover-picker
            [currentSrc]="coverUrl(item)"
            [resetToken]="coverEditReset()"
            (changed)="coverEditSelection.set($event)"
            (valid)="coverEditValid.set($event)"
          />
          <app-button [disabled]="saving() || !coverEditValid()" (click)="saveCoverEdit(item)">
            {{ saving() ? 'Salvando…' : 'Salvar capa' }}
          </app-button>
        </div>
      }
    </app-sheet>
  `,
  styleUrl: './items-list.component.scss',
})
export class ItemsListComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly couples = inject(CoupleService);
  private readonly auth = inject(AuthService);
  private readonly coversService = inject(CoverService);
  private readonly searchProvider = inject(MOVIE_SEARCH_PROVIDER);
  private readonly destroyRef = inject(DestroyRef);
  private cancelRealtime?: () => void;
  private activeCoupleId: string | null = null;
  private initialLoadComplete = false;
  private readonly realtimeBuffer: RealtimeChange[] = [];
  private searchSequence = 0;

  readonly config = input.required<ItemListConfig>();
  readonly covers = this.coversService;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly trailerControl = new FormControl('', { nonNullable: true });
  readonly items = signal<ListItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly reordering = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly trailerError = signal<string | null>(null);
  readonly duplicateError = signal<string | null>(null);
  readonly searching = signal(false);
  readonly searchReady = signal(false);
  readonly searchResults = signal<SearchResult[]>([]);
  readonly formSheetOpen = signal(false);
  readonly selectedCover = signal<CoverSelection | null | undefined>(null);
  readonly coverValid = signal(true);
  readonly pickerReset = signal(0);
  readonly editingItem = signal<ListItem | null>(null);
  readonly coverEditItem = signal<ListItem | null>(null);
  readonly coverEditSelection = signal<CoverSelection | null | undefined>(undefined);
  readonly coverEditValid = signal(true);
  readonly coverPickerReset = signal(0);
  readonly confirmRemoveId = signal<string | null>(null);
  readonly skeletons = [1, 2, 3];
  readonly pendingItems = computed(() =>
    sortByPosition(this.items().filter((item) => item.status === 'PENDING')),
  );
  readonly watchedItems = computed(() =>
    [...this.items()]
      .filter((item) => item.status === 'DONE')
      .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')),
  );
  readonly form = new FormRecord<FormControl<string>>({});
  readonly availableSearchResults = computed(() => {
    const existing = this.items();
    const seen = new Set<string>();
    return this.searchResults()
      .flatMap((result) => [result, ...(result.related ?? [])])
      .filter((result) => {
        const key = this.searchResultKey(result);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return !existing.some((item) => this.isSameSearchMovie(item, result));
      });
  });

  constructor() {
    effect(() => {
      const config = this.config();
      Object.keys(this.form.controls).forEach((key) => this.form.removeControl(key));
      for (const field of config.formFields) {
        const validators = [];
        if (field.required) {
          validators.push(Validators.required);
        }
        if (field.maxLength) {
          validators.push(Validators.maxLength(field.maxLength));
        }
        if (field.kind === 'year') {
          validators.push(
            Validators.pattern(/^\d{4}$/),
            Validators.min(1888),
            Validators.max(new Date().getFullYear() + 5),
          );
        }
        this.form.addControl(field.key, new FormControl('', {
          nonNullable: true,
          validators,
        }));
      }
    });

    this.searchControl.valueChanges
      .pipe(
        startWith(this.searchControl.value),
        map((query) => query.trim()),
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((query) => {
        if (this.config().searchProvider) {
          void this.search(query);
        }
      });

    effect(() => {
      const paths = this.items()
        .map((item) => item.metadata.cover_path)
        .filter((path): path is string => typeof path === 'string' && !!path);
      void this.coversService.prime(paths).catch(() => undefined);
    });

    this.destroyRef.onDestroy(() => {
      this.cancelRealtime?.();
      this.coversService.stopRenewal();
    });
    effect(() => {
      const coupleId = this.couples.couple()?.id;
      const type = this.config().type;
      if (coupleId) {
        void this.initialize(coupleId, type);
      }
    });
  }

  openAddSheet(): void {
    this.editingItem.set(null);
    const values = Object.fromEntries(
      this.config().formFields.map((field) => [field.key, '']),
    );
    if (this.config().type === 'PLACE') {
      values['category'] = 'Passeio';
    }
    if (this.config().searchProvider) {
      values[this.config().titleField] = this.searchControl.value.trim();
    }
    this.form.reset(values);
    this.trailerControl.reset('');
    this.resetPicker();
    this.clearFormErrors();
    this.formSheetOpen.set(true);
  }

  openEdit(item: ListItem): void {
    this.editingItem.set(item);
    this.form.reset(this.config().readFormValues(item));
    this.trailerControl.reset(
      typeof item.metadata['trailer_url'] === 'string'
        ? item.metadata['trailer_url']
        : '',
    );
    this.selectedCover.set(undefined);
    this.coverValid.set(true);
    this.pickerReset.update((value) => value + 1);
    this.clearFormErrors();
    this.formSheetOpen.set(true);
  }

  editOnCard(item: ListItem): void {
    if (this.config().type === 'PLACE') {
      this.openEdit(item);
    }
  }

  closeFormSheet(): void {
    this.formSheetOpen.set(false);
    this.editingItem.set(null);
    this.trailerControl.reset('');
    this.trailerError.set(null);
    this.resetPicker();
    this.clearFormErrors();
  }

  fieldError(field: ItemFormField): string | null {
    const control = this.form.controls[field.key];
    if (!control || (!control.touched && !control.dirty)) {
      return null;
    }
    if (control.hasError('required')) {
      return `Informe ${field.label.toLocaleLowerCase()}.`;
    }
    if (control.hasError('maxlength')) {
      return `Use no máximo ${field.maxLength} caracteres.`;
    }
    if (control.hasError('pattern')) {
      return 'Informe o ano com quatro dígitos.';
    }
    if (control.hasError('min')) {
      return 'O ano deve ser 1888 ou posterior.';
    }
    if (control.hasError('max')) {
      return `O ano deve ser até ${new Date().getFullYear() + 5}.`;
    }
    return null;
  }

  async saveForm(): Promise<void> {
    this.clearFormErrors();
    this.trailerError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const values = this.form.getRawValue();
    if (this.config().type === 'PLACE' && values['link']) {
      const validLink = this.coversService.validateExternalUrl(values['link']);
      if (!validLink) {
        this.formError.set(
          /^http:/i.test(values['link'])
            ? 'Use um link que comece com https://'
            : 'Informe um link HTTPS válido com até 500 caracteres.',
        );
        return;
      }
      values['link'] = validLink;
    }

    const title = values[this.config().titleField]?.trim() ?? '';
    const rawTrailer = this.config().type === 'MOVIE' ? this.trailerControl.value.trim() : '';
    const trailerUrl = rawTrailer ? this.normalizeTrailerUrl(rawTrailer) : null;
    if (rawTrailer && !trailerUrl) {
      this.trailerError.set('Informe um link válido de trailer do YouTube.');
      return;
    }

    const duplicateItems = this.items().filter((item) => item.id !== this.editingItem()?.id);
    if (this.config().isDuplicate(title, values, duplicateItems)) {
      this.duplicateError.set('Esse item já está na lista de vocês.');
      return;
    }

    this.saving.set(true);
    let uploadedPath: string | null = null;
    const selection = this.selectedCover();
    const editing = this.editingItem();
    try {
      if (selection?.kind === 'file') {
        uploadedPath = await this.coversService.upload(selection.blob);
      }

      const builtMetadata = this.config().buildMetadata(values);
      const metadata = editing
        ? { ...editing.metadata, ...builtMetadata }
        : builtMetadata;
      if (this.config().type === 'MOVIE') {
        if (trailerUrl) {
          metadata['trailer_url'] = trailerUrl;
        } else {
          delete metadata['trailer_url'];
        }
      }
      if (selection?.kind === 'file' && uploadedPath) {
        metadata['cover_path'] = uploadedPath;
      } else if (selection !== undefined) {
        delete metadata['cover_path'];
      }
      const imageUrl =
        selection?.kind === 'url'
          ? selection.url
            : selection?.kind === 'file' || selection === null
            ? null
            : editing?.image_url ?? null;

      if (editing) {
        const updated = await this.itemsService.update(editing.id, {
          title,
          image_url: imageUrl,
          metadata,
        });
        this.upsertItem(updated);
        this.closeFormSheet();
        const oldPath = editing.metadata.cover_path;
        if (
          typeof oldPath === 'string' &&
          oldPath &&
          oldPath !== uploadedPath &&
          selection !== undefined
        ) {
          await this.coversService.remove(oldPath);
        }
      } else {
        const created = await this.itemsService.add({
          type: this.config().type,
          title,
          external_id: null,
          image_url: imageUrl,
          metadata,
        });
        this.upsertItem(created);
        this.closeFormSheet();
        if (this.config().searchProvider) {
          this.searchControl.setValue('');
          this.searchResults.set([]);
          this.searchReady.set(false);
        }
      }
    } catch (error: unknown) {
      if (uploadedPath) {
        await this.coversService.remove(uploadedPath);
      }
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async addSearchResult(result: SearchResult): Promise<void> {
    const values = { year: result.year === null ? '' : String(result.year) };
    if (this.items().some((item) => this.isSameSearchMovie(item, result))) {
      this.error.set('Esse item já está na lista de vocês.');
      return;
    }

    this.saving.set(true);
    try {
      const metadata = this.config().buildMetadata({
        ...values,
        title: result.title,
        note: '',
      });
      if (result.overview) {
        metadata['overview'] = result.overview;
      }
      if (result.genres?.length) {
        metadata['genres'] = result.genres;
      }
      const item = await this.itemsService.add({
        type: this.config().type,
        title: result.title,
        external_id: result.external_id,
        image_url: result.image_url,
        metadata,
      });
      this.upsertItem(item);
      this.searchControl.setValue('');
      this.searchResults.set([]);
      this.searchReady.set(false);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async drop(event: CdkDragDrop<ListItem[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const previous = this.items();
    const ordered = this.pendingItems();
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);
    const ids = ordered.map((item) => item.id);
    const positions = new Map(ids.map((id, index) => [id, index + 1]));
    this.items.set(sortByPosition(previous.map((item) => ({
      ...item,
      position: positions.get(item.id) ?? item.position,
    }))));
    this.reordering.set(true);
    try {
      await this.itemsService.reorder(ids);
    } catch (error: unknown) {
      this.items.set(previous);
      this.error.set(this.errorMessage(error));
    } finally {
      this.reordering.set(false);
    }
  }

  async toggleStatus(item: ListItem): Promise<void> {
    const status: ItemStatus = item.status === 'PENDING' ? 'DONE' : 'PENDING';
    const previous = this.items();
    const pending = this.pendingItems().filter((candidate) => candidate.id !== item.id);
    if (status === 'PENDING') {
      pending.push({ ...item, status, done_at: null });
    }
    const positions = new Map(pending.map((candidate, index) => [candidate.id, index + 1]));
    this.items.set(previous.map((candidate) => candidate.id === item.id
      ? { ...candidate, status, done_at: status === 'DONE' ? new Date().toISOString() : null }
      : candidate).map((candidate) => ({
        ...candidate,
        position: positions.get(candidate.id) ?? candidate.position,
      })));
    try {
      await this.itemsService.setStatus(item.id, status);
      if (status === 'PENDING') {
        await this.itemsService.reorder(pending.map((candidate) => candidate.id));
      }
    } catch (error: unknown) {
      this.items.set(previous);
      this.error.set(this.errorMessage(error));
    }
  }

  async remove(item: ListItem): Promise<void> {
    const previous = this.items();
    this.items.set(previous.filter((candidate) => candidate.id !== item.id));
    this.confirmRemoveId.set(null);
    try {
      await this.itemsService.remove(item.id);
      const path = item.metadata.cover_path;
      if (typeof path === 'string') {
        await this.coversService.remove(path);
      }
    } catch (error: unknown) {
      this.items.set(previous);
      this.error.set(this.errorMessage(error));
    }
  }

  async saveCoverEdit(item: ListItem): Promise<void> {
    const selection = this.coverEditSelection();
    if (selection === undefined) {
      this.closeCoverEditor();
      return;
    }
    this.saving.set(true);
    let uploadedPath: string | null = null;
    const oldPath = item.metadata.cover_path;
    try {
      if (selection?.kind === 'file') {
        uploadedPath = await this.coversService.upload(selection.blob);
      }
      const metadata = { ...item.metadata };
      if (uploadedPath) {
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
      if (typeof oldPath === 'string' && oldPath && oldPath !== uploadedPath) {
        await this.coversService.remove(oldPath);
      }
    } catch (error: unknown) {
      if (uploadedPath) {
        await this.coversService.remove(uploadedPath);
      }
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  closeCoverEditor(): void {
    this.coverEditItem.set(null);
    this.coverEditSelection.set(undefined);
    this.coverEditReset.update((value) => value + 1);
  }

  readonly coverEditReset = signal(0);

  coverUrl(item: ListItem): string | null {
    return this.coversService.urlFor(item);
  }

  addedBy(item: ListItem): string {
    return item.added_by === this.auth.user()?.id
      ? 'Você'
      : this.couples.partner()?.name ?? 'Seu par';
  }

  doneDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  placeLink(item: ListItem): string | null {
    const value = item.metadata['link'];
    return typeof value === 'string' ? this.coversService.validateExternalUrl(value) : null;
  }

  protected searchResultKey(result: SearchResult): string {
    return result.external_id ?? `${result.title}-${result.year ?? ''}`;
  }

  trailerVideoId(item: ListItem): string | null {
    const raw = item.metadata['trailer_url'];
    return typeof raw === 'string' ? this.youtubeVideoId(raw) : null;
  }

  trailerUrl(item: ListItem): string | null {
    const videoId = this.trailerVideoId(item);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  }

  trailerThumbnail(videoId: string): string {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  private normalizeTrailerUrl(raw: string): string | null {
    const videoId = this.youtubeVideoId(raw);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  }

  private isSameSearchMovie(item: ListItem, result: SearchResult): boolean {
    if (result.external_id !== null && item.external_id === result.external_id) {
      return true;
    }
    const sameTitle =
      item.title.trim().toLocaleLowerCase() === result.title.trim().toLocaleLowerCase();
    const itemYear = item.metadata.year;
    return sameTitle &&
      (result.year === null || itemYear == null || itemYear === result.year);
  }

  private youtubeVideoId(raw: string): string | null {
    try {
      const url = new URL(raw.trim());
      const host = url.hostname.toLocaleLowerCase();
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)
      ) {
        return null;
      }

      let videoId: string | null = null;
      if (host === 'youtu.be') {
        videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
      } else if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (/^\/(embed|shorts|live)\//.test(url.pathname)) {
        videoId = url.pathname.split('/')[2] ?? null;
      }

      return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
    } catch {
      return null;
    }
  }

  mapUrl(item: ListItem): string {
    const city = item.metadata['city'];
    const address = typeof city === 'string' ? city : '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [item.title, address].filter(Boolean).join(' '),
    )}`;
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
        this.searchError.set('Não foi possível buscar sugestões agora. Você ainda pode adicionar o filme manualmente.');
        this.searchReady.set(true);
      }
    } finally {
      if (sequence === this.searchSequence) {
        this.searching.set(false);
      }
    }
  }

  private async initialize(coupleId: string, type: ListItem['type']): Promise<void> {
    this.activeCoupleId = coupleId;
    this.cancelRealtime?.();
    this.initialLoadComplete = false;
    this.realtimeBuffer.length = 0;
    this.cancelRealtime = this.itemsService.subscribe(
      type,
      coupleId,
      (change) => {
        if (!this.initialLoadComplete) {
          this.realtimeBuffer.push(change);
        } else {
          this.applyChange(change);
        }
      },
    );
    try {
      this.items.set(await this.itemsService.list(type));
      if (this.destroyRef.destroyed || this.activeCoupleId !== coupleId) {
        return;
      }
      this.initialLoadComplete = true;
      this.realtimeBuffer.forEach((change) => this.applyChange(change));
      this.realtimeBuffer.length = 0;
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
      this.initialLoadComplete = true;
    } finally {
      this.loading.set(false);
    }
  }

  private applyChange(change: RealtimeChange): void {
    if (change.eventType === 'DELETE' && change.id) {
      this.items.update((items) => items.filter((item) => item.id !== change.id));
    } else if (change.item) {
      this.upsertItem(change.item);
    }
  }

  private upsertItem(item: ListItem): void {
    this.items.update((items) => sortByPosition(
      items.some((candidate) => candidate.id === item.id)
        ? items.map((candidate) => candidate.id === item.id ? item : candidate)
        : [...items, item],
    ));
  }

  protected toggleRemoveConfirmation(id: string | null): void {
    this.confirmRemoveId.set(this.confirmRemoveId() === id ? null : id);
  }

  protected openCoverEditor(item: ListItem): void {
    this.coverEditItem.set(item);
    this.coverEditSelection.set(undefined);
    this.coverEditValid.set(true);
    this.coverEditReset.update((value) => value + 1);
  }

  private resetPicker(selection: CoverSelection | null | undefined = null): void {
    this.selectedCover.set(selection);
    this.coverValid.set(true);
    this.pickerReset.update((value) => value + 1);
  }

  private clearFormErrors(): void {
    this.error.set(null);
    this.formError.set(null);
    this.duplicateError.set(null);
    this.trailerError.set(null);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error && error.message
      ? error.message
      : 'Não foi possível salvar agora. Tente novamente.';
  }
}
