export interface AppErrorOptions {
  code?: string;
  status?: number;
  details?: unknown;
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = options.details;
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export const Errors = {
  BadRequest: (message = 'Bad Request', code = 'BAD_REQUEST') =>
    new AppError(message, { status: 400, code }),
  Unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new AppError(message, { status: 401, code }),
  Forbidden: (message = 'Forbidden', code = 'FORBIDDEN') =>
    new AppError(message, { status: 403, code }),
  NotFound: (message = 'Not Found', code = 'NOT_FOUND') =>
    new AppError(message, { status: 404, code }),
  Conflict: (message = 'Conflict', code = 'CONFLICT') =>
    new AppError(message, { status: 409, code }),
  Locked: (message = 'Account locked', code = 'ACCOUNT_LOCKED') =>
    new AppError(message, { status: 423, code }),
  TooMany: (message = 'Too many requests', code = 'TOO_MANY_REQUESTS') =>
    new AppError(message, { status: 429, code }),
  MustChangePassword: (message = 'Password must be changed', code = 'PASSWORD_EXPIRED') =>
    new AppError(message, { status: 403, code }),
};
