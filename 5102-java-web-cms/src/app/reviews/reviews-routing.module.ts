import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReviewListComponent } from './review-list.component';
import { ReviewHistoryComponent } from './review-history.component';

const routes: Routes = [
  {
    path: '',
    component: ReviewListComponent,
  },
  {
    path: 'history/:documentId',
    component: ReviewHistoryComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReviewsRoutingModule {}
