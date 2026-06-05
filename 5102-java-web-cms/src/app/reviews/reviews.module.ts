import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ReviewsRoutingModule } from './reviews-routing.module';
import { ReviewListComponent } from './review-list.component';
import { ReviewHistoryComponent } from './review-history.component';

@NgModule({
  declarations: [ReviewListComponent, ReviewHistoryComponent],
  imports: [SharedModule, ReviewsRoutingModule],
})
export class ReviewsModule {}
