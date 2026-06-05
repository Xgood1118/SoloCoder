import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { DocumentsRoutingModule } from './documents-routing.module';
import { DocumentListComponent } from './document-list.component';
import { DocumentDetailComponent } from './document-detail.component';
import { DocumentEditorComponent } from './document-editor.component';

@NgModule({
  declarations: [DocumentListComponent, DocumentDetailComponent, DocumentEditorComponent],
  imports: [SharedModule, DocumentsRoutingModule],
})
export class DocumentsModule {}
