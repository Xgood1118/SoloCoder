import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { DynamicFormComponent } from './components/dynamic-form/dynamic-form.component';
import { ConditionEditorComponent } from './components/condition-editor/condition-editor.component';

import { FormListComponent } from './pages/form-list/form-list.component';
import { FormEditorComponent } from './pages/form-editor/form-editor.component';
import { FormFillComponent } from './pages/form-fill/form-fill.component';
import { SubmissionsComponent } from './pages/submissions/submissions.component';
import { TemplatesComponent } from './pages/templates/templates.component';
import { WebhookLogsComponent } from './pages/webhook-logs/webhook-logs.component';

@NgModule({
  declarations: [
    AppComponent,
    DynamicFormComponent,
    ConditionEditorComponent,
    FormListComponent,
    FormEditorComponent,
    FormFillComponent,
    SubmissionsComponent,
    TemplatesComponent,
    WebhookLogsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
