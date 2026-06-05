import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { SearchRoutingModule } from './search-routing.module';
import { AdvancedSearchComponent } from './advanced-search.component';

@NgModule({
  declarations: [AdvancedSearchComponent],
  imports: [SharedModule, SearchRoutingModule],
})
export class SearchModule {}
