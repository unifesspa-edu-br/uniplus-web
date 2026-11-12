import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { apiFailure, apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  ConcessoesApi,
  type ConcessaoDto,
} from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { UNIDADES, ok } from './testes';

/** Apoio dos specs da página de concessões: recusas de campo, a concessão ativa e a montagem. */

/** A recusa de validação com o erro no campo dado, como a API a devolve. */
function recusaDoCampo(field: string, code: string, message: string) {
  return apiFailure(
    {
      type: 'x',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: '',
      errors: [{ field, code, message }],
    },
    422,
    new HttpHeaders(),
  );
}

export const DIVERGENCIA_DE_EMAIL = recusaDoCampo(
  'confirmacaoEmail',
  'uniplus.autorizacao.concessao.confirmacao_divergente',
  'O e-mail informado não é o do beneficiário da concessão.',
);

export const RECUSA_DO_MOTIVO = recusaDoCampo(
  'Motivo',
  'uniplus.autorizacao.concessao.motivo_invalido',
  'Motivo recusado.',
);

export const URL = 'http://api.test/api/autorizacao/concessoes';
export const ativa: ConcessaoDto = {
  id: 'c1',
  beneficiario: { emissor: 'unifesspa', sub: '0123456789abcdef' },
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  versao: 2,
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  origem: { tipo: 'pedido', id: 'pedido-1' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  revogadaPelaJanelaId: null,
  motivoRevogacao: null,
  ativa: true,
};

export function dublesDeConcessoes() {
  return {
    api: { revogar: vi.fn() },
    notificacoes: { success: vi.fn(), errorFromProblem: vi.fn() },
  };
}

/** A leitura passa pelo `HttpTestingController`; a revogação e as notificações vão aos dublês. */
function provedoresDaPagina(dubles: ReturnType<typeof dublesDeConcessoes>) {
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    { provide: ConcessoesApi, useValue: dubles.api },
    { provide: NotificationService, useValue: dubles.notificacoes },
    { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
  ];
}

/** Configura a página e devolve o controlador da leitura. */
export function configurarConcessoes(
  dubles: ReturnType<typeof dublesDeConcessoes>,
): HttpTestingController {
  TestBed.configureTestingModule({ providers: provedoresDaPagina(dubles) });
  return TestBed.inject(HttpTestingController);
}

export async function atualizar(): Promise<void> {
  await Promise.resolve();
  TestBed.inject(ApplicationRef).tick();
}
