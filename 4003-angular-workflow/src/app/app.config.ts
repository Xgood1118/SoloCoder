import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard.component';
import { TemplateListComponent } from './components/template-list.component';
import { TemplateDesignerComponent } from './components/template-designer.component';
import { StartProcessComponent } from './components/start-process.component';
import { TodoListComponent } from './components/todo-list.component';
import { ApproveDetailComponent } from './components/approve-detail.component';
import { MyInstancesComponent } from './components/my-instances.component';
import { InstanceDetailComponent } from './components/instance-detail.component';
import { ResubmitComponent } from './components/resubmit.component';

const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'templates', component: TemplateListComponent },
  { path: 'template/:id', component: TemplateDesignerComponent },
  { path: 'start/:id', component: StartProcessComponent },
  { path: 'todo', component: TodoListComponent },
  { path: 'approve/:id', component: ApproveDetailComponent },
  { path: 'my-instances', component: MyInstancesComponent },
  { path: 'instance/:id', component: InstanceDetailComponent },
  { path: 'resubmit/:id', component: ResubmitComponent },
  { path: '**', redirectTo: '' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes)
  ]
};
