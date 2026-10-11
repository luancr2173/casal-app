import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ItemsListComponent } from '../shared/items-list/items-list.component';
import { moviesListConfig } from '../shared/items-list/items-list.config';

@Component({
  selector: 'app-movies-page',
  imports: [ItemsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-items-list [config]="config" />',
})
export class MoviesPage {
  protected readonly config = moviesListConfig;
}
