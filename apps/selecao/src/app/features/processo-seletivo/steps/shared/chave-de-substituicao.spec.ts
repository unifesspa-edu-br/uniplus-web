import { describe, expect, it } from 'vitest';
import { ApiFailure, IDEMPOTENCY_KEY_TOKEN, ProblemDetails } from '@uniplus/shared-core/http';

import { ChaveDeSubstituicao } from './chave-de-substituicao';

const CORPO = { cobra: true, valor: 80 };
const OUTRO_CORPO = { cobra: true, valor: 90 };

function falha(problem: Partial<ProblemDetails>): ApiFailure {
  return {
    ok: false,
    problem: {
      type: 'about:blank',
      title: 'Recusado.',
      status: 400,
      code: 'uniplus.selecao.invalido',
      traceId: 'trace-1',
      ...problem,
    },
  };
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

    /** Recusa definitiva: prender a chave repetiria para sempre o recusado. */
    it.each([
      ['validação', { status: 400 }],
      ['corpo divergente', { code: 'uniplus.idempotency.body_mismatch', status: 409 }],
      ['corpo grande demais', { status: 413 }],
    ])('gira a chave em %s', (_caso, problem) => {
      const chave = new ChaveDeSubstituicao();
      const usada = chaveDe(chave, CORPO);
      chave.recusada(falha(problem));
      expect(chaveDe(chave, CORPO)).not.toBe(usada);
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
