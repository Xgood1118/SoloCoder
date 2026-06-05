import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'fullscreen/:widgetId',
    loadComponent: () => import('./features/fullscreen-chart/fullscreen-chart.component').then(m => m.FullscreenChartComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
