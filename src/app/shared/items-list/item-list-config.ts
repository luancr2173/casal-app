import type { ItemType, ListItem } from '../../core/models';

export interface ItemFormField {
  key: string;
  label: string;
  kind: 'text' | 'year' | 'note' | 'category' | 'url';
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  options?: readonly string[];
}

export interface ItemListConfig {
  type: ItemType;
  title: string;
  subtitle: string;
  pendingLabel: string;
  doneLabel: string;
  doneVerb: string;
  emptyTitle: string;
  emptyText: string;
  addButtonLabel: string;
  searchProvider: boolean;
  formTitle: string;
  formFields: readonly ItemFormField[];
  titleField: string;
  buildMetadata(values: Record<string, string>): Record<string, unknown>;
  readFormValues(item: ListItem): Record<string, string>;
  cardSubtitles(item: ListItem): string[];
  isDuplicate(
    title: string,
    values: Record<string, string>,
    items: readonly ListItem[],
  ): boolean;
}
