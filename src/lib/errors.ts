/** 服務層統一丟出的錯誤型別，UI 依 code 決定呈現方式。 */
export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NETWORK'
  | 'NOT_IMPLEMENTED';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '請先登入') {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '你沒有執行這項操作的權限') {
    super('FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = '找不到資料') {
    super('NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

/** http adapter 尚未實作時丟出，提醒開發者這裡才是接後端的位置。 */
export class NotImplementedError extends AppError {
  constructor(what: string) {
    super('NOT_IMPLEMENTED', `${what} 尚未實作：請在 src/services/http/ 接上後端 API`);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toErrorMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return '發生未知錯誤，請稍後再試';
}
