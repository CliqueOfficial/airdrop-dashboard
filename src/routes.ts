import { lazy } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';

import Home from './pages/home';
import { Dashboard } from './pages/dashboard';

export const routes: RouteDefinition[] = [
  {
    path: '/',
    component: lazy(() => import('./pages/home')),
  },
  {
    path: '/about',
    component: lazy(() => import('./pages/about')),
  },
  {
    path: '/new',
    component: lazy(() => import('./pages/new')),
  },
  {
    path: '**',
    component: lazy(() => import('./errors/404')),
  },
];
