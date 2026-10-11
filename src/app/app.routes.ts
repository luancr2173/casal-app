import { Routes } from '@angular/router';
import { PlaceholderPage } from './pages/placeholder.page';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'inicio',
    component: PlaceholderPage,
    data: { title: 'Início', subtitle: 'Um espaço para viver bons momentos juntos.' },
  },
  {
    path: 'filmes',
    component: PlaceholderPage,
    data: { title: 'Filmes', subtitle: 'Escolham o próximo filme para assistir.' },
  },
  {
    path: 'lugares',
    component: PlaceholderPage,
    data: { title: 'Lugares', subtitle: 'Ideias de lugares para descobrir a dois.' },
  },
  {
    path: 'perfil',
    component: PlaceholderPage,
    data: { title: 'Perfil', subtitle: 'Um cantinho para a história de vocês.' },
  },
];
