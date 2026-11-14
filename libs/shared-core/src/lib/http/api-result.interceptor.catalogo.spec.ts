import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiFailure } from './api-result';
import {
  AmbienteHttp,
  baseProblem,
  chamadaGet,
  falhaDe,
  prepararAmbienteHttp,
  problemJson,
} from './api-result.interceptor.testing';
import { NotificationService } from '../services/notification.service';
import { ProblemDetails } from './problem-details';
import { ProblemI18nService } from './problem-i18n.service';

describe('apiResultInterceptor', () => {
  let ambiente: AmbienteHttp;

  beforeEach(() => {
    ambiente = prepararAmbienteHttp();
  });

  afterEach(() => {
    ambiente.controller.verify();
  });

  describe('catálogo desatualizado', () => {
    const MENSAGEM = 'O sistema está sendo atualizado. Tente novamente em instantes.';
    const desatualizado: ProblemDetails = {
      type: 'x',
      title: 'Catalog out of date',
      detail: 'The catalog is being rebuilt',
      status: 503,
      code: 'uniplus.autorizacao.catalogo.desatualizado',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    };

    function textoDaMensagem(m: { title: string; detail?: string }): string {
      return m.detail ? `${m.title} ${m.detail}` : m.title;
    }

    function falhar(): ApiFailure {
      const simulada = problemJson(503, 'Service Unavailable', desatualizado);
      return falhaDe(ambiente, chamadaGet('/api/autorizacao/x'), simulada);
    }

    it('entrega o título e o detalhe em pt-BR a quem lê o problema direto', () => {
      const { problem } = falhar();

      expect(problem.title).toBe(MENSAGEM);
      expect(problem.detail).toBeUndefined();
      expect(problem.code).toBe(desatualizado.code);
    });

    it('chega assim à notificação direta', () => {
      const notificacoes = TestBed.inject(NotificationService);

      notificacoes.errorFromProblem(falhar().problem);

      const [toast] = notificacoes.notifications();
      expect(toast?.title).toBe(MENSAGEM);
      expect(toast?.detail).toBeUndefined();
    });

    it('chega inteira à tela que mostra só o título resolvido', () => {
      const { title } = TestBed.inject(ProblemI18nService).resolve(falhar().problem);

      expect(title).toBe(MENSAGEM);
    });

    it('chega assim à recusa junto à ação, que resolve o problema pelo serviço de mensagens', () => {
      const mensagem = TestBed.inject(ProblemI18nService).resolve(falhar().problem);

      expect(mensagem.title).toBe(MENSAGEM);
      expect(mensagem.detail).toBeUndefined();
      expect(textoDaMensagem(mensagem)).toBe(MENSAGEM);
    });

    it('não altera o texto de outros problemas', () => {
      const simulada = problemJson(404, 'Not Found', baseProblem);

      const fail = falhaDe(ambiente, chamadaGet('/api/x'), simulada);

      expect(fail.problem.title).toBe('Edital não encontrado');
    });
  });
});
