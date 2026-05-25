import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { StorageService } from './services/storage.service';
import { TemplateService } from './services/template.service';
import { ProcessService } from './services/process.service';
import { DemoDataService } from './services/demo-data.service';
import { UserSwitcherComponent } from './components/user-switcher.component';
import { User, FlowTemplate } from './models/workflow.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterOutlet, UserSwitcherComponent],
  template: `
    <div class="app-layout">
      <nav class="navbar">
        <div class="nav-container">
          <div class="nav-brand" routerLink="/">
            <span class="brand-icon">⚙️</span>
            <span class="brand-name">工作流引擎</span>
          </div>
          <div class="nav-menu">
            <a routerLink="/" routerLinkActive="active" class="nav-item">
              <span>📊</span>
              <span>仪表盘</span>
            </a>
            <a routerLink="/templates" routerLinkActive="active" class="nav-item">
              <span>📋</span>
              <span>模板管理</span>
            </a>
            <a routerLink="/todo" routerLinkActive="active" class="nav-item">
              <span>⏳</span>
              <span>待办审批</span>
              <span *ngIf="todoCount > 0" class="badge">{{ todoCount }}</span>
            </a>
            <a routerLink="/my-instances" routerLinkActive="active" class="nav-item">
              <span>📝</span>
              <span>我的流程</span>
            </a>
          </div>
          <div class="nav-user">
            <app-user-switcher 
              [users]="users" 
              [currentUser]="currentUser"
              (userChange)="onUserChange($event)">
            </app-user-switcher>
          </div>
        </div>
      </nav>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .navbar {
      background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      align-items: center;
      height: 56px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      margin-right: 40px;
    }
    .brand-icon {
      font-size: 24px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }
    .nav-menu {
      display: flex;
      gap: 8px;
      flex: 1;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 4px;
      text-decoration: none;
      color: #666;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .nav-item:hover {
      background: #f5f5f5;
      color: #1890ff;
    }
    .nav-item.active {
      background: #e6f7ff;
      color: #1890ff;
    }
    .badge {
      background: #ff4d4f;
      color: white;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }
    .nav-user {
      margin-left: auto;
    }
    .main-content {
      flex: 1;
    }
  `]
})
export class AppComponent implements OnInit {
  users: User[] = [];
  currentUser: User;
  todoCount = 0;

  constructor(
    private storage: StorageService,
    private processService: ProcessService,
    private templateService: TemplateService,
    private demoDataService: DemoDataService,
    private router: Router
  ) {
    this.currentUser = this.storage.getCurrentUser();
  }

  ngOnInit(): void {
    this.users = this.storage.getUsers();
    this.initDemoData();
    this.updateTodoCount();
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateTodoCount();
    });
  }

  initDemoData(): void {
    this.demoDataService.initDemoData();
  }

  onUserChange(user: User): void {
    this.storage.saveCurrentUser(user);
    this.currentUser = user;
    this.updateTodoCount();
  }

  updateTodoCount(): void {
    const pendingList = this.processService.getMyPendingApprovals(this.currentUser.id);
    this.todoCount = pendingList.length;
  }
}
