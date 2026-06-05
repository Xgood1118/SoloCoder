import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTreeModule } from 'ng-zorro-antd/tree';
import { NzTreeSelectModule } from 'ng-zorro-antd/tree-select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzAffixModule } from 'ng-zorro-antd/affix';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzCommentModule } from 'ng-zorro-antd/comment';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzPageHeaderModule } from 'ng-zorro-antd/page-header';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';

import { CommentListComponent } from './components/comment-list.component';

const NZ_MODULES = [
  NzButtonModule,
  NzInputModule,
  NzFormModule,
  NzTableModule,
  NzPaginationModule,
  NzModalModule,
  NzMessageModule,
  NzSelectModule,
  NzDatePickerModule,
  NzTreeModule,
  NzTreeSelectModule,
  NzTagModule,
  NzCardModule,
  NzSpaceModule,
  NzLayoutModule,
  NzMenuModule,
  NzDropDownModule,
  NzAvatarModule,
  NzBadgeModule,
  NzToolTipModule,
  NzPopconfirmModule,
  NzCheckboxModule,
  NzRadioModule,
  NzTabsModule,
  NzAffixModule,
  NzBreadCrumbModule,
  NzEmptyModule,
  NzSkeletonModule,
  NzSpinModule,
  NzDrawerModule,
  NzDividerModule,
  NzListModule,
  NzCommentModule,
  NzAutocompleteModule,
  NzAlertModule,
  NzPageHeaderModule,
  NzSwitchModule,
  NzTimelineModule,
];

@NgModule({
  declarations: [CommentListComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ...NZ_MODULES],
  exports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ...NZ_MODULES, CommentListComponent],
})
export class SharedModule {}
