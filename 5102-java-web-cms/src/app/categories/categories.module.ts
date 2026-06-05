import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { CategoriesRoutingModule } from './categories-routing.module';
import { CategoryManagementComponent } from './category-management.component';

@NgModule({
  declarations: [CategoryManagementComponent],
  imports: [SharedModule, CategoriesRoutingModule],
})
export class CategoriesModule {}
