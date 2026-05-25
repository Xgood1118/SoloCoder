import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../models/workflow.model';

@Component({
  selector: 'app-user-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="user-switcher">
      <span class="label">当前用户:</span>
      <select class="user-select" [(ngModel)]="selectedUserId" (change)="onUserChange()">
        <option *ngFor="let user of users" [value]="user.id">{{ user.name }} ({{ user.department }} - {{ user.role }})</option>
      </select>
    </div>
  `,
  styles: [`
    .user-switcher {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .label {
      color: #666;
      font-size: 14px;
    }
    .user-select {
      padding: 4px 8px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 14px;
    }
  `]
})
export class UserSwitcherComponent {
  @Input() users: User[] = [];
  @Input() currentUser!: User;
  @Output() userChange = new EventEmitter<User>();

  selectedUserId: string = '';

  ngOnInit(): void {
    if (this.currentUser) {
      this.selectedUserId = this.currentUser.id;
    }
  }

  onUserChange(): void {
    const user = this.users.find(u => u.id === this.selectedUserId);
    if (user) {
      this.userChange.emit(user);
    }
  }
}
