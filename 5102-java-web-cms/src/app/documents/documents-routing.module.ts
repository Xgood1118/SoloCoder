import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocumentListComponent } from './document-list.component';
import { DocumentDetailComponent } from './document-detail.component';
import { DocumentEditorComponent } from './document-editor.component';

const routes: Routes = [
  {
    path: '',
    component: DocumentListComponent,
  },
  {
    path: 'new',
    component: DocumentEditorComponent,
  },
  {
    path: ':id',
    component: DocumentDetailComponent,
  },
  {
    path: ':id/edit',
    component: DocumentEditorComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DocumentsRoutingModule {}
