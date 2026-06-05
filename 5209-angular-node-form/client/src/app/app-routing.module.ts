import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormListComponent } from './pages/form-list/form-list.component';
import { FormEditorComponent } from './pages/form-editor/form-editor.component';
import { FormFillComponent } from './pages/form-fill/form-fill.component';
import { SubmissionsComponent } from './pages/submissions/submissions.component';
import { TemplatesComponent } from './pages/templates/templates.component';
import { WebhookLogsComponent } from './pages/webhook-logs/webhook-logs.component';

const routes: Routes = [
  { path: '', redirectTo: '/forms', pathMatch: 'full' },
  { path: 'forms', component: FormListComponent },
  { path: 'forms/new', component: FormEditorComponent },
  { path: 'forms/:id', component: FormFillComponent },
  { path: 'forms/:id/edit', component: FormEditorComponent },
  { path: 'forms/:id/submissions', component: SubmissionsComponent },
  { path: 'templates', component: TemplatesComponent },
  { path: 'webhook-logs', component: WebhookLogsComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
