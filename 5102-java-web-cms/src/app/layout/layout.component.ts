import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { I18nService } from '../core/services/i18n.service';

@Component({
  selector: 'app-layout',
  template: `
    <nz-layout class="layout">
      <nz-header class="header">
        <div class="header-content">
          <div class="logo">
            <h1>CMS 内容管理系统</h1>
          </div>
          <div class="header-search">
            <app-header-search></app-header-search>
          </div>
          <div class="header-right">
            <a nz-dropdown [nzDropdownMenu]="userMenu" nzTrigger="click">
              <nz-avatar nzIcon="user" [nzText]="authService.currentUser?.realName?.[0] || 'U'"></nz-avatar>
              <span class="username">{{ authService.currentUser?.realName || '访客' }}</span>
              <i nz-icon nzType="down"></i>
            </a>
            <nz-dropdown-menu #userMenu="nzDropdownMenu">
              <ul nz-menu>
                <li nz-menu-item *ngIf="!authService.isLoggedIn" (click)="login()">
                  <i nz-icon nzType="login"></i> 登录
                </li>
                <li nz-menu-item *ngIf="authService.isLoggedIn" (click)="logout()">
                  <i nz-icon nzType="logout"></i> 退出登录
                </li>
              </ul>
            </nz-dropdown-menu>
          </div>
        </div>
      </nz-header>
      <nz-layout>
        <nz-sider nzWidth="280px" class="sidebar">
          <ul nz-menu nzMode="inline" class="sidebar-menu">
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/documents')">
              <i nz-icon nzType="file-text"></i>
              <span>文档管理</span>
            </li>
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/categories')">
              <i nz-icon nzType="folder"></i>
              <span>分类管理</span>
            </li>
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/tags')">
              <i nz-icon nzType="tags"></i>
              <span>标签管理</span>
            </li>
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/reviews')">
              <i nz-icon nzType="audit"></i>
              <span>审核管理</span>
            </li>
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/templates')">
              <i nz-icon nzType="layout"></i>
              <span>模板管理</span>
            </li>
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/review-configs')" *ngIf="authService.hasRole(['admin'])">
              <i nz-icon nzType="setting"></i>
              <span>审核配置</span>
            </li>
            <li nz-menu-item nzMatchRouterExact (click)="navigate('/search')">
              <i nz-icon nzType="search"></i>
              <span>高级搜索</span>
            </li>
          </ul>
          <div class="sidebar-tree">
            <div class="tree-header">分类导航</div>
            <app-category-tree (categorySelect)="onCategorySelect($event)"></app-category-tree>
          </div>
        </nz-sider>
        <nz-content class="main-content">
          <router-outlet></router-outlet>
        </nz-content>
      </nz-layout>
    </nz-layout>
  `,
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public i18nService: I18nService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  onCategorySelect(categoryIds: string[]): void {
    this.router.navigate(['/documents'], {
      queryParams: { categoryIds: categoryIds.join(',') },
    });
  }

  login(): void {
    this.authService.login({ username: 'admin', password: 'admin' }).subscribe();
  }

  logout(): void {
    this.authService.logout();
  }
}
