import type { ListItem } from '../../core/models';
import type { ItemListConfig } from './item-list-config';

function text(item: ListItem, key: string): string {
  const value = item.metadata[key];
  return typeof value === 'string' ? value : '';
}

function sameTitle(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export const moviesListConfig: ItemListConfig = {
  type: 'MOVIE',
  title: 'Filmes',
  subtitle: 'Uma lista de histórias para assistir juntos.',
  pendingLabel: 'Para assistir',
  doneLabel: 'Assistidos',
  doneVerb: 'assistido',
  emptyTitle: 'Sua próxima noite de cinema começa aqui',
  emptyText: 'Busque um filme acima para adicioná-lo à lista de vocês.',
  addButtonLabel: 'Adicionar filme',
  searchProvider: true,
  formTitle: 'Adicionar filme',
  titleField: 'title',
  formFields: [
    { key: 'title', label: 'Título', kind: 'text', placeholder: 'Nome do filme', required: true, maxLength: 200 },
    { key: 'year', label: 'Ano (opcional)', kind: 'year', placeholder: 'AAAA' },
    { key: 'note', label: 'Observação (opcional)', kind: 'note', placeholder: 'Uma nota para vocês' },
  ],
  buildMetadata: (values) => ({
    year: values['year'] ? Number(values['year']) : null,
    note: values['note']?.trim() || null,
  }),
  readFormValues: (item) => ({
    title: item.title,
    year: item.metadata.year == null ? '' : String(item.metadata.year),
    note: text(item, 'note'),
  }),
  cardSubtitles: (item) => [
    ...(item.metadata.year ? [String(item.metadata.year)] : []),
    ...(text(item, 'note').trim() ? [text(item, 'note')] : []),
  ],
  isDuplicate: (title, values, items) => items.some(
    (item) =>
      sameTitle(item.title, title) &&
      String(item.metadata.year ?? '') === (values['year'] ?? ''),
  ),
};

export const placesListConfig: ItemListConfig = {
  type: 'PLACE',
  title: 'Lugares',
  subtitle: 'Ideias de lugares para conhecer juntos.',
  pendingLabel: 'Para visitar',
  doneLabel: 'Visitados',
  doneVerb: 'visitado',
  emptyTitle: 'Qual lugar vocês querem conhecer?',
  emptyText: 'Guardem aqui os passeios, restaurantes e viagens que sonham fazer.',
  addButtonLabel: 'Adicionar lugar',
  searchProvider: false,
  formTitle: 'Adicionar lugar',
  titleField: 'name',
  formFields: [
    { key: 'name', label: 'Nome do lugar', kind: 'text', placeholder: 'Ex.: Jardim Botânico', required: true, maxLength: 200 },
    { key: 'category', label: 'Categoria', kind: 'category', options: ['Passeio', 'Restaurante', 'Viagem', 'Outro'] },
    { key: 'city', label: 'Cidade ou endereço', kind: 'text', placeholder: 'Cidade ou endereço', maxLength: 200 },
    { key: 'link', label: 'Link (opcional)', kind: 'url', placeholder: 'https://exemplo.com', maxLength: 500 },
    { key: 'note', label: 'Observação (opcional)', kind: 'note', placeholder: 'Uma nota para vocês', maxLength: 500 },
  ],
  buildMetadata: (values) => ({
    category: values['category'] || 'Passeio',
    city: values['city']?.trim() || null,
    link: values['link']?.trim() || null,
    note: values['note']?.trim() || null,
  }),
  readFormValues: (item) => ({
    name: item.title,
    category: text(item, 'category') || 'Passeio',
    city: text(item, 'city'),
    link: text(item, 'link'),
    note: text(item, 'note'),
  }),
  cardSubtitles: (item) => {
    const category = text(item, 'category') || 'Passeio';
    const city = text(item, 'city');
    const detail = [category, city].filter(Boolean).join(' · ');
    const note = text(item, 'note').trim();
    return [detail, ...(note ? [note] : [])];
  },
  isDuplicate: (title, values, items) => items.some(
    (item) =>
      sameTitle(item.title, title) &&
      text(item, 'city').trim().toLocaleLowerCase() ===
        (values['city'] ?? '').trim().toLocaleLowerCase(),
  ),
};
