import { InjectionToken, Injectable } from '@angular/core';

export type SearchResult = {
  external_id: string | null;
  title: string;
  year: number | null;
  overview: string;
  image_url: string | null;
  genres?: string[];
  related?: SearchResult[];
};

export interface MovieSearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

@Injectable({ providedIn: 'root' })
export class ManualSearchProvider implements MovieSearchProvider {
  async search(_query: string): Promise<SearchResult[]> {
    return [];
  }
}

export const MOVIE_SEARCH_PROVIDER = new InjectionToken<MovieSearchProvider>(
  'MOVIE_SEARCH_PROVIDER',
  {
    providedIn: 'root',
    factory: () => new ManualSearchProvider(),
  },
);
