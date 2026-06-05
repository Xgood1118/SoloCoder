import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { NzMessageService } from 'ng-zorro-antd/message';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private messageService: NzMessageService
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    let authRequest = request;

    if (this.authService.token) {
      authRequest = request.clone({
        headers: request.headers.set(
          'Authorization',
          `Bearer ${this.authService.token}`
        ),
      });
    }

    return next.handle(authRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = '操作失败';

        if (error.status === 401) {
          errorMessage = '未授权，请先登录';
          this.authService.logout();
        } else if (error.status === 403) {
          errorMessage = '没有权限访问';
        } else if (error.status === 404) {
          errorMessage = '资源不存在';
        } else if (error.status >= 500) {
          errorMessage = '服务器错误，请稍后重试';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        this.messageService.error(errorMessage);
        return throwError(() => error);
      })
    );
  }
}
