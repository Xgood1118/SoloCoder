import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  navItems = [
    { label: '构建任务', icon: 'build', route: '/build' },
    { label: '部署审批', icon: 'rocket_launch', route: '/deploy' },
    { label: '环境管理', icon: 'cloud', route: '/environments' },
    { label: '回滚操作', icon: 'restore', route: '/rollback' },
    { label: '任务队列', icon: 'view_kanban', route: '/queue' },
  ];

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.router.events.subscribe(() => {
      if (this.sidenav && window.innerWidth < 1024) {
        this.sidenav.close();
      }
    });
  }

  onNavClick(route: string): void {
    this.router.navigate([route]);
  }

  logout(): void {
    this.auth.logout();
  }
}
