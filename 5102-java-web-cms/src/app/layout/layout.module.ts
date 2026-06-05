import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { LayoutRoutingModule } from './layout-routing.module';
import { LayoutComponent } from './layout.component';
import { HeaderSearchComponent } from './header-search.component';
import { CategoryTreeComponent } from './category-tree.component';

@NgModule({
  declarations: [LayoutComponent, HeaderSearchComponent, CategoryTreeComponent],
  imports: [SharedModule, LayoutRoutingModule],
})
export class LayoutModule {}
