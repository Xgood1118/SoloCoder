import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { TagsRoutingModule } from './tags-routing.module';
import { TagListComponent } from './tag-list.component';

@NgModule({
  declarations: [TagListComponent],
  imports: [SharedModule, TagsRoutingModule],
})
export class TagsModule {}
