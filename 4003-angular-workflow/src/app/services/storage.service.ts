import { Injectable } from '@angular/core';
import { FlowTemplate, FlowInstance, User } from '../models/workflow.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private TEMPLATES_KEY = 'workflow_templates';
  private INSTANCES_KEY = 'workflow_instances';
  private USERS_KEY = 'workflow_users';
  private CURRENT_USER_KEY = 'workflow_current_user';

  getTemplates(): FlowTemplate[] {
    const data = localStorage.getItem(this.TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  }

  saveTemplates(templates: FlowTemplate[]): void {
    localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(templates));
  }

  getTemplate(id: string): FlowTemplate | undefined {
    return this.getTemplates().find(t => t.id === id);
  }

  saveTemplate(template: FlowTemplate): void {
    const templates = this.getTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    this.saveTemplates(templates);
  }

  deleteTemplate(id: string): void {
    const templates = this.getTemplates().filter(t => t.id !== id);
    this.saveTemplates(templates);
  }

  getInstances(): FlowInstance[] {
    const data = localStorage.getItem(this.INSTANCES_KEY);
    return data ? JSON.parse(data) : [];
  }

  saveInstances(instances: FlowInstance[]): void {
    localStorage.setItem(this.INSTANCES_KEY, JSON.stringify(instances));
  }

  getInstance(id: string): FlowInstance | undefined {
    return this.getInstances().find(i => i.id === id);
  }

  saveInstance(instance: FlowInstance): void {
    const instances = this.getInstances();
    const index = instances.findIndex(i => i.id === instance.id);
    if (index >= 0) {
      instances[index] = instance;
    } else {
      instances.push(instance);
    }
    this.saveInstances(instances);
  }

  deleteInstance(id: string): void {
    const instances = this.getInstances().filter(i => i.id !== id);
    this.saveInstances(instances);
  }

  getUsers(): User[] {
    const data = localStorage.getItem(this.USERS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    const defaultUsers: User[] = [
      { id: 'u1', name: '张三', role: '员工', department: '技术部' },
      { id: 'u2', name: '李四', role: '部门负责人', department: '技术部' },
      { id: 'u3', name: '王五', role: 'HR经理', department: '人事部' },
      { id: 'u4', name: '赵六', role: '总经理', department: '总经办' },
      { id: 'u5', name: '钱七', role: '总裁', department: '总经办' }
    ];
    this.saveUsers(defaultUsers);
    return defaultUsers;
  }

  saveUsers(users: User[]): void {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  getCurrentUser(): User {
    const data = localStorage.getItem(this.CURRENT_USER_KEY);
    if (data) {
      return JSON.parse(data);
    }
    const users = this.getUsers();
    this.saveCurrentUser(users[0]);
    return users[0];
  }

  saveCurrentUser(user: User): void {
    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
