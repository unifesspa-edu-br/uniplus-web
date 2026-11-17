import { describe, expect, it } from 'vitest';
import type { ApiFailure } from './api-result';
import type { ProblemDetails } from './problem-details';
import { errorResult, mockProblemDetails } from './api-result.testing';
import { CODIGO_ESPERA_ESGOTADA, IDEMPOTENCY_KEY_TOKEN } from './idempotency';
import { CLIENT_PROBLEM_CODES } from './problem-details';

import { ChaveDeSubstituicao } from './chave-de-substituicao';

const CORPO = { cobra: true, valor: 80 };
const OUTRO_CORPO = { cobra: true, valor: 90 };

function falha(problem: Partial<ProblemDetails>): ApiFailure {
  return errorResult(
    mockProblemDetails({
      type: 'about:blank',
      title: 'Recusado.',
      status: 400,
      code: 'uniplus.selecao.invalido',
      traceId: 'trace-1',
      ...problem,
    }),
  );
}

function chaveDe(chave: ChaveDeSubstituicao, corpo: unknown): string | null {
  return chave.contextoPara(corpo).get(IDEMPOTENCY_KEY_TOKEN);
}

describe('ChaveDeSubstituicao', () => {
  it('repete a chave enquanto o corpo for o mesmo', () => {
    const chave = new ChaveDeSubstituicao();
    expect(chaveDe(chave, CORPO)).toBe(chaveDe(chave, CORPO));
  });

  /** Corpo novo sob chave retida receberia `body_mismatch` do filtro. */
  it('gira a chave quando o corpo muda', () => {
    const chave = new ChaveDeSubstituicao();
    const primeira = chaveDe(chave, CORPO);
    expect(chaveDe(chave, OUTRO_CORPO)).not.toBe(primeira);
  });

  it('gira a chave depois de renovar', () => {
    const chave = new ChaveDeSubstituicao();
    const primeira = chaveDe(chave, CORPO);
    chave.renovar();
    expect(chaveDe(chave, CORPO)).not.toBe(primeira);
  });

  describe('recusa', () => {
    /** A execução anterior ainda pode concluir: repetir igual é o correto. */
    it.each([
      ['processing_conflict', { code: 'uniplus.idempotency.processing_conflict', status: 409 }],
      ['falha de rede', { code: 'uniplus.client.network_error', status: 0 }],
      ['erro do servidor', { code: 'uniplus.internal', status: 500 }],
    ])('preserva a chave em %s', (_caso, problem) => {
      const chave = new ChaveDeSubstituicao();
      const usada = chaveDe(chave, CORPO);
      chave.recusada(falha(problem));
      expect(chaveDe(chave, CORPO)).toBe(usada);
    });

    /** Resposta ilegível de um comando que o servidor pode ter executado: chave nova o executaria de novo. */
    it.each([
      ['2xx com corpo inválido', { code: CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE, status: 200 }],
      ['3xx que chega como falha', { code: CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE, status: 302 }],
      ['status 0 sem código de erro de rede', { code: 'uniplus.test.fake', status: 0 }],
    ])('preserva a chave e é inconclusiva em %s', (_caso, problem) => {
      const chave = new ChaveDeSubstituicao();
      const usada = chaveDe(chave, CORPO);
      expect(chave.recusada(falha(problem))).toBe(true);
      expect(chaveDe(chave, CORPO)).toBe(usada);
    });

    it.each([
      ['processing_conflict', { code: 'uniplus.idempotency.processing_conflict', status: 409 }],
      ['falha de rede', { code: CLIENT_PROBLEM_CODES.NETWORK_ERROR, status: 0 }],
      ['erro do servidor', { code: 'uniplus.internal', status: 500 }],
    ])('é inconclusiva em %s', (_caso, problem) => {
      const chave = new ChaveDeSubstituicao();
      chaveDe(chave, CORPO);
      expect(chave.recusada(falha(problem))).toBe(true);
    });

    /** Recusa definitiva: prender a chave repetiria para sempre o recusado. */
    it.each([
      ['validação', { status: 400 }],
      ['corpo divergente', { code: 'uniplus.idempotency.body_mismatch', status: 409 }],
      ['corpo grande demais', { status: 413 }],
      ['processo ocupado (503 guardado na chave)', { code: CODIGO_ESPERA_ESGOTADA, status: 503 }],
    ])('gira a chave em %s', (_caso, problem) => {
      const chave = new ChaveDeSubstituicao();
      const usada = chaveDe(chave, CORPO);
      chave.recusada(falha(problem));
      expect(chaveDe(chave, CORPO)).not.toBe(usada);
    });

    it.each([
      ['validação', { status: 400 }],
      ['corpo divergente', { code: 'uniplus.idempotency.body_mismatch', status: 409 }],
    ])('não é inconclusiva em %s: o servidor recusou sem executar', (_caso, problem) => {
      const chave = new ChaveDeSubstituicao();
      chaveDe(chave, CORPO);
      expect(chave.recusada(falha(problem))).toBe(false);
    });

    it('não trata o 503 de processo ocupado como inconclusivo: nada foi aplicado', () => {
      const chave = new ChaveDeSubstituicao();
      chaveDe(chave, CORPO);
      expect(chave.recusada(falha({ code: CODIGO_ESPERA_ESGOTADA, status: 503 }))).toBe(false);
    });

    /**
     * Depois de girar por recusa definitiva, o corpo retido some junto: reenviar
     * o mesmo corpo não pode ser lido como "o corpo mudou" e girar de novo, ou o
     * servidor nunca veria duas vezes a mesma chave.
     */
    it('mantém a chave nova ao reenviar o corpo recusado', () => {
      const chave = new ChaveDeSubstituicao();
      chaveDe(chave, CORPO);
      chave.recusada(falha({ status: 400 }));

      const apos = chaveDe(chave, CORPO);
      expect(chaveDe(chave, CORPO)).toBe(apos);
    });
  });
});
