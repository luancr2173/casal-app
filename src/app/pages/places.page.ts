import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ItemsListComponent } from '../shared/items-list/items-list.component';
import { placesListConfig } from '../shared/items-list/items-list.config';

@Component({
  selector: 'app-places-page',
  imports: [ItemsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-items-list [config]="config" />',
})
export class PlacesPage {
  protected readonly config = placesListConfig;
}
