import { Routes } from '@angular/router';
import { PlaceholderPage } from './pages/placeholder.page';
import { authGuard, coupleGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'entrar',
    loadComponent: () => import('./pages/login.page').then((page) => page.LoginPage),
    canActivate: [guestGuard],
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./pages/signup.page').then((page) => page.SignupPage),
    canActivate: [guestGuard],
  },
  {
    path: 'espaco',
    loadComponent: () => import('./pages/space.page').then((page) => page.SpacePage),
    canActivate: [authGuard],
  },
  {
    path: 'inicio',
    component: PlaceholderPage,
    canActivate: [authGuard, coupleGuard],
    data: { title: 'Início', subtitle: 'Um espaço para viver bons momentos juntos.' },
  },
  {
    path: 'filmes',
    loadComponent: () => import('./pages/movies.page').then((page) => page.MoviesPage),
    canActivate: [authGuard, coupleGuard],
  },
  {
    path: 'lugares',
    loadComponent: () => import('./pages/places.page').then((page) => page.PlacesPage),
    canActivate: [authGuard, coupleGuard],
  },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/profile.page').then((page) => page.ProfilePage),
    canActivate: [authGuard, coupleGuard],
  },
];
