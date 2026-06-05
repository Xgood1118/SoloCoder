import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/build',
    pathMatch: 'full',
  },
  {
    path: 'build',
    loadComponent: () => import('./features/build/build-list.component').then((m) => m.BuildListComponent),
  },
  {
    path: 'build/new',
    loadComponent: () => import('./features/build/build-new.component').then((m) => m.BuildNewComponent),
  },
  {
    path: 'build/:id',
    loadComponent: () => import('./features/build/build-detail.component').then((m) => m.BuildDetailComponent),
  },
  {
    path: 'deploy',
    loadComponent: () => import('./features/deploy/deploy-list.component').then((m) => m.DeployListComponent),
  },
  {
    path: 'deploy/new',
    loadComponent: () => import('./features/deploy/deploy-new.component').then((m) => m.DeployNewComponent),
  },
  {
    path: 'deploy/:id',
    loadComponent: () => import('./features/deploy/deploy-detail.component').then((m) => m.DeployDetailComponent),
  },
  {
    path: 'approval',
    loadComponent: () => import('./features/approval/approval-list.component').then((m) => m.ApprovalListComponent),
  },
  {
    path: 'approval/config',
    loadComponent: () => import('./features/approval/approval-config.component').then((m) => m.ApprovalConfigComponent),
  },
  {
    path: 'environments',
    loadComponent: () => import('./features/environment/environment-list.component').then((m) => m.EnvironmentListComponent),
  },
  {
    path: 'environments/new',
    loadComponent: () => import('./features/environment/environment-form.component').then((m) => m.EnvironmentFormComponent),
  },
  {
    path: 'environments/:id',
    loadComponent: () => import('./features/environment/environment-form.component').then((m) => m.EnvironmentFormComponent),
  },
  {
    path: 'rollback',
    loadComponent: () => import('./features/rollback/rollback-list.component').then((m) => m.RollbackListComponent),
  },
  {
    path: 'rollback/new',
    loadComponent: () => import('./features/rollback/rollback-new.component').then((m) => m.RollbackNewComponent),
  },
  {
    path: 'queue',
    loadComponent: () => import('./features/queue/queue-overview.component').then((m) => m.QueueOverviewComponent),
  },
  {
    path: 'queue/graph',
    loadComponent: () => import('./features/queue/dependency-graph.component').then((m) => m.DependencyGraphComponent),
  },
];
