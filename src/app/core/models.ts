export type ItemType =
  | 'MOVIE'
  | 'SERIES'
  | 'PLACE'
  | 'RESTAURANT'
  | 'TRIP'
  | 'GAME'
  | 'BOOK';

export type ItemStatus = 'PENDING' | 'DONE';

export interface Couple {
  id: string;
  name: string | null;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  couple_id: string | null;
  name: string;
}

export interface ListItem {
  id: string;
  couple_id: string;
  type: ItemType;
  title: string;
  external_id: string | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
  position: number;
  status: ItemStatus;
  added_by: string | null;
  done_at: string | null;
  created_at: string;
}

export interface Rating {
  item_id: string;
  user_id: string;
  score: number;
  comment: string | null;
}
