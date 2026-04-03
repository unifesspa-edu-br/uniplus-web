import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        notification.error('Erro de conexão', 'Não foi possível conectar ao servidor.');
      } else if (error.status >= 500) {
        notification.error('Erro do servidor', 'Ocorreu um erro interno. Tente novamente mais tarde.');
      }
      return throwError(() => error);
    }),
  );
};
