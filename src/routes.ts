import { lazy } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';

import Home from './pages/home';

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
    path: '/dashboard/:appId',
    component: lazy(() => import('./pages/dashboard')),
  },
  {
    path: '/wizard',
    component: lazy(() => import('./pages/wizard')),
  },
  {
    path: '**',
    component: lazy(() => import('./errors/404')),
  },
];
