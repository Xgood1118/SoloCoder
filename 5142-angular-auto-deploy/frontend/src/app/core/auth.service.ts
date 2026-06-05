import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User, LoginRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSignal = signal<User | null>(null);

  currentUser = computed(() => this.currentUserSignal());
  isLoggedIn = computed(() => !!this.currentUserSignal());
  isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');
  isApprover = computed(() => {
    const role = this.currentUserSignal()?.role;
    return role === 'approver' || role === 'admin';
  });

  constructor(
    private api: ApiService,
    private router: Router,
  ) {
    this.restoreSession();
  }

  login(request: LoginRequest): Observable<{ message: string; user: User }> {
    return this.api.post<{ message: string; user: User }>('/auth/login', request).pipe(
      tap((res) => {
        this.currentUserSignal.set(res.user);
        localStorage.setItem('user', JSON.stringify(res.user));
      }),
    );
  }

  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem('user');
    this.api.post('/auth/logout', {}).subscribe();
    this.router.navigate(['/build']);
  }

  private restoreSession(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.currentUserSignal.set(JSON.parse(userStr));
      } catch {
        localStorage.removeItem('user');
      }
    }
  }
}
