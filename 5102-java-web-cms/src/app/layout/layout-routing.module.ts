import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutComponent } from './layout.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'documents',
        pathMatch: 'full',
      },
      {
        path: 'documents',
        loadChildren: () => import('../documents/documents.module').then((m) => m.DocumentsModule),
      },
      {
        path: 'categories',
        loadChildren: () => import('../categories/categories.module').then((m) => m.CategoriesModule),
      },
      {
        path: 'tags',
        loadChildren: () => import('../tags/tags.module').then((m) => m.TagsModule),
      },
      {
        path: 'search',
        loadChildren: () => import('../search/search.module').then((m) => m.SearchModule),
      },
      {
        path: 'reviews',
        loadChildren: () => import('../reviews/reviews.module').then((m) => m.ReviewsModule),
      },
      {
        path: 'templates',
        loadChildren: () => import('../templates/templates.module').then((m) => m.TemplatesModule),
      },
      {
        path: 'review-configs',
        loadChildren: () => import('../review-configs/review-configs.module').then((m) => m.ReviewConfigsModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayoutRoutingModule {}
