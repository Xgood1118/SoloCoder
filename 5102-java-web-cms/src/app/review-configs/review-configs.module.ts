import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ReviewConfigsRoutingModule } from './review-configs-routing.module';
import { ReviewConfigListComponent } from './review-config-list.component';

@NgModule({
  declarations: [ReviewConfigListComponent],
  imports: [SharedModule, ReviewConfigsRoutingModule],
})
export class ReviewConfigsModule {}
