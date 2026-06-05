import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, LoginRequest, LoginResponse, UserRole } from '../models/user.model';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private tokenSubject = new BehaviorSubject<string | null>(null);
  token$ = this.tokenSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  constructor(private apiService: ApiService) {
    this.init();
  }

  private init(): void {
    const savedToken = localStorage.getItem('cms_token');
    const savedUser = localStorage.getItem('cms_user');

    if (savedToken && savedUser) {
      try {
        this.tokenSubject.next(savedToken);
        this.currentUserSubject.next(JSON.parse(savedUser));
      } catch {
        this.clearAuth();
      }
    }
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return new Observable((observer) => {
      this.apiService.login(request).subscribe({
        next: (response) => {
          const user: User = {
            id: response.user.id,
            username: response.user.username,
            realName: response.user.realName,
            department: response.user.department,
            role: (response.user.role || '').toLowerCase() as UserRole,
            email: response.user.email,
            createdAt: new Date(response.user.createdAt).getTime(),
            updatedAt: new Date(response.user.updatedAt).getTime(),
          };
          this.setAuth(response.token, user);
          observer.next({
            token: response.token,
            user,
          });
          observer.complete();
        },
        error: (err) => observer.error(err),
      });
    });
  }

  logout(): void {
    this.apiService.logout().subscribe({
      next: () => this.clearAuth(),
      error: () => this.clearAuth(),
    });
  }

  private setAuth(token: string, user: User): void {
    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
    localStorage.setItem('cms_token', token);
    localStorage.setItem('cms_user', JSON.stringify(user));
  }

  private clearAuth(): void {
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    localStorage.removeItem('cms_token');
    localStorage.removeItem('cms_user');
  }

  hasRole(role: UserRole | UserRole[]): boolean {
    const user = this.currentUser;
    if (!user) return false;

    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }

  canEditDocument(authorId: string): boolean {
    const user = this.currentUser;
    if (!user) return false;

    return user.role === 'admin' || (user.role === 'contributor' && user.id === authorId);
  }

  canDeleteDocument(authorId: string): boolean {
    const user = this.currentUser;
    if (!user) return false;

    return user.role === 'admin' || (user.role === 'contributor' && user.id === authorId);
  }

  canDeleteComment(authorId: string): boolean {
    const user = this.currentUser;
    if (!user) return false;

    return user.role === 'admin' || user.id === authorId;
  }
}
