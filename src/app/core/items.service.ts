import { Injectable, inject } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ItemStatus, ItemType, ListItem } from './models';
import { SupabaseService } from './supabase.service';

export interface NewListItem {
  type: ItemType;
  title: string;
  external_id: string | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
}

export type ItemChange =
  | { eventType: 'INSERT' | 'UPDATE'; item: ListItem }
  | { eventType: 'DELETE'; id: string };

export type ItemChangeHandler = (change: ItemChange) => void;

function isListItem(value: unknown): value is ListItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item['id'] === 'string' &&
    typeof item['couple_id'] === 'string' &&
    typeof item['type'] === 'string' &&
    typeof item['title'] === 'string' &&
    typeof item['position'] === 'number' &&
    (item['status'] === 'PENDING' || item['status'] === 'DONE') &&
    typeof item['metadata'] === 'object' &&
    item['metadata'] !== null
  );
}

function friendlyError(): Error {
  return new Error('Não foi possível salvar agora. Tente novamente.');
}

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly supabase = inject(SupabaseService);

  async list(type: ItemType): Promise<ListItem[]> {
    const { data, error } = await this.supabase.client
      .from('list_items')
      .select('*')
      .eq('type', type)
      .order('position', { ascending: true });

    if (error) {
      throw friendlyError();
    }

    return data;
  }

  async add(input: NewListItem): Promise<ListItem> {
    const { data, error } = await this.supabase.client
      .from('list_items')
      .insert({
        type: input.type,
        title: input.title,
        external_id: input.external_id,
        image_url: input.image_url,
        metadata: input.metadata,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw friendlyError();
    }

    return data;
  }

  async setStatus(id: string, status: ItemStatus): Promise<void> {
    const { error } = await this.supabase.client
      .from('list_items')
      .update({ status })
      .eq('id', id);

    if (error) {
      throw friendlyError();
    }
  }

  async update(
    id: string,
    patch: { image_url?: string | null; metadata?: Record<string, unknown> },
  ): Promise<ListItem> {
    const { data, error } = await this.supabase.client
      .from('list_items')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw friendlyError();
    }

    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('list_items').delete().eq('id', id);

    if (error) {
      throw friendlyError();
    }
  }

  async reorder(ids: string[]): Promise<void> {
    const { error } = await this.supabase.client.rpc('reorder_items', {
      p_ids: ids,
    });

    if (error) {
      throw friendlyError();
    }
  }

  subscribe(
    type: ItemType,
    coupleId: string,
    handler: ItemChangeHandler,
  ): () => void {
    const channel: RealtimeChannel = this.supabase.client
      .channel(`list-items-${coupleId}-${type}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'list_items',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old['id'];
            if (typeof id === 'string') {
              handler({ eventType: 'DELETE', id });
            }
            return;
          }

          if (isListItem(payload.new) && payload.new.type === type) {
            handler({ eventType: payload.eventType, item: payload.new });
          }
        },
      )
      .subscribe();

    return () => {
      void this.supabase.client.removeChannel(channel);
    };
  }
}
