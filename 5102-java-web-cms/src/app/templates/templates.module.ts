import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { TemplatesRoutingModule } from './templates-routing.module';
import { TemplateListComponent } from './template-list.component';

@NgModule({
  declarations: [TemplateListComponent],
  imports: [SharedModule, TemplatesRoutingModule],
})
export class TemplatesModule {}
