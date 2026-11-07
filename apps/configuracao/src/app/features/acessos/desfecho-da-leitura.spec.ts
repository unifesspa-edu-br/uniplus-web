import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { desfechoDaLeitura } from './desfecho-da-leitura';
import { FALHA_INESPERADA_DE_LEITURA } from './mensagens-de-acesso';

const problemas = {
  resolve: (problema: ProblemDetails) => ({ title: problema.title }),
} as unknown as ProblemI18nService;

const problema = (status: number, title: string): ProblemDetails => ({
  type: 'x',
  title,
  status,
  code: 'uniplus.x',
  traceId: '',
});

function consulta(problem: ProblemDetails | null = null, error?: Error) {
  return { problem: signal(problem), error: signal(error) };
}

describe('desfechoDaLeitura', () => {
  it.each([401, 403, 404])(
    'a recusa %s não é falha: repetir a leitura não muda a resposta',
    (status) => {
      const desfecho = desfechoDaLeitura([consulta(problema(status, 'Recusado'))], problemas);

      expect(desfecho.recusa()).toEqual({ texto: 'Recusado', status });
      expect(desfecho.falha()).toBeNull();
    },
  );

  it('a falha do servidor é falha, não recusa', () => {
    const desfecho = desfechoDaLeitura([consulta(problema(503, 'Indisponível'))], problemas);

    expect(desfecho.falha()).toBe('Indisponível');
    expect(desfecho.recusa()).toBeNull();
  });

  it('o erro fora do contrato da API é falha com texto próprio', () => {
    const desfecho = desfechoDaLeitura([consulta(null, new Error('rede'))], problemas);

    expect(desfecho.falha()).toBe(FALHA_INESPERADA_DE_LEITURA);
  });

  it('a recusa de uma das leituras vale mais que a falha da outra', () => {
    const desfecho = desfechoDaLeitura(
      [consulta(problema(503, 'Indisponível')), consulta(problema(404, 'Não encontrado'))],
      problemas,
    );

    expect(desfecho.mensagem()).toBe('Não encontrado');
    expect(desfecho.falha()).toBeNull();
  });

  it('sem problema nem erro não há mensagem', () => {
    const desfecho = desfechoDaLeitura([consulta()], problemas);

    expect(desfecho.mensagem()).toBeNull();
  });
});
