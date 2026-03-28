import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

/** RFC 7807 Problem Details */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

@Injectable({ providedIn: 'root' })
export class ApiErrorHandlerService {
  parse(error: HttpErrorResponse): ProblemDetails {
    if (error.error && typeof error.error === 'object' && 'title' in error.error) {
      return error.error as ProblemDetails;
    }

    return {
      title: this.getDefaultTitle(error.status),
      status: error.status,
      detail: error.message,
    };
  }

  getValidationErrors(problem: ProblemDetails): string[] {
    if (!problem.errors) return [];
    return Object.entries(problem.errors).flatMap(([field, messages]) =>
      messages.map((msg) => `${field}: ${msg}`),
    );
  }

  private getDefaultTitle(status: number): string {
    const titles: Record<number, string> = {
      400: 'Requisição inválida',
      401: 'Não autorizado',
      403: 'Acesso negado',
      404: 'Recurso não encontrado',
      409: 'Conflito de dados',
      422: 'Dados não processáveis',
      500: 'Erro interno do servidor',
    };
    return titles[status] || 'Erro desconhecido';
  }
}
