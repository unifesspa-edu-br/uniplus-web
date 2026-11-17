import { describe, expect, it, vi } from 'vitest';
import type { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import type { NotificationService } from '@uniplus/shared-core/notifications';
import { mensagemDaRecusa } from './falha-de-servidor';

const CODIGO = 'uniplus.autorizacao.perfil.etapa_invalida';
const problemas = {
  resolve: () => ({ title: 'Título do código.', detail: 'Orientação do código.' }),
} as unknown as ProblemI18nService;
const notificacoes = { errorFromProblem: vi.fn() } as unknown as NotificationService;

function recusa(errors?: ProblemDetails['errors']): ProblemDetails {
  return { type: 'x', title: 'Recusado', status: 409, code: CODIGO, traceId: 't', errors };
}

describe('mensagemDaRecusa', () => {
  it('sem causa geral, dá o título e a orientação do código', () => {
    expect(mensagemDaRecusa(problemas, notificacoes, recusa())).toBe(
      'Título do código. Orientação do código.',
    );
  });

  it('a causa geral dá o motivo no lugar do título e a orientação do código continua', () => {
    const texto = mensagemDaRecusa(
      problemas,
      notificacoes,
      recusa([{ code: 'geral', message: 'O perfil está bloqueado.' }]),
    );

    expect(texto).toBe('O perfil está bloqueado. Orientação do código.');
  });

  it('a causa geral de código sem orientação vai sozinha', () => {
    const semOrientacao = {
      resolve: () => ({ title: 'Título.' }),
    } as unknown as ProblemI18nService;

    expect(
      mensagemDaRecusa(
        semOrientacao,
        notificacoes,
        recusa([{ code: 'geral', message: 'O perfil está bloqueado.' }]),
      ),
    ).toBe('O perfil está bloqueado.');
  });
});
