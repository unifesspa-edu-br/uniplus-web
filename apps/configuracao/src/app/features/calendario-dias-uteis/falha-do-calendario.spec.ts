import { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { classificarFalha } from './falha-do-calendario';

const problema = (
  status: number,
  code: string,
  extra: Partial<ProblemDetails> = {},
): ProblemDetails => ({
  type: 'about:blank',
  title: 'Falha',
  status,
  code,
  traceId: '',
  ...extra,
});

describe('classificação da falha ao gravar o calendário', () => {
  it('a duplicidade da data vale com ou sem campo apontado, e renova a chave', () => {
    const codigo = 'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset';
    const comCampo = problema(422, codigo, {
      errors: [{ field: 'diasNaoUteis[1]', code: codigo, message: 'x' }],
    });

    expect(classificarFalha(problema(422, codigo))).toMatchObject({
      tipo: 'dataDuplicada',
      rotacionarChave: true,
    });
    expect(classificarFalha(comCampo).tipo).toBe('dataDuplicada');
  });

  it('a recusa com campos apontados manda para os campos', () => {
    const falha = classificarFalha(
      problema(422, 'uniplus.configuracao.calendario_dias_uteis.data_ausente', {
        errors: [
          {
            field: 'diasNaoUteis[0].data',
            code: 'uniplus.configuracao.calendario_dias_uteis.data_ausente',
            message: 'm',
          },
        ],
      }),
    );

    expect(falha).toEqual({ tipo: 'campos', rotacionarChave: true, doServidor: false });
  });

  it('a recusa de referência de cidade chega com campo, como toda recusa de campo', () => {
    const codigo = 'uniplus.cidade_referencia.uf_incoerente';
    const falha = classificarFalha(
      problema(422, codigo, {
        errors: [{ field: 'diasNaoUteis[1].municipioUf', code: codigo, message: 'm' }],
      }),
    );

    expect(falha.tipo).toBe('campos');
  });

  it('a recusa 422 sem campo apontado vai ao alerta', () => {
    expect(
      classificarFalha(problema(422, 'uniplus.configuracao.calendario_dias_uteis.sem_dia_nao_util'))
        .tipo,
    ).toBe('geral');
  });

  it('o 409 de execução em curso mantém a chave: o reenvio é do mesmo comando', () => {
    expect(classificarFalha(problema(409, 'uniplus.idempotency.processing_conflict'))).toEqual({
      tipo: 'geral',
      rotacionarChave: false,
      doServidor: false,
    });
  });

  it.each([
    [409, 'uniplus.configuracao.calendario_dias_uteis.conflito_de_concorrencia'],
    [404, 'uniplus.configuracao.calendario_dias_uteis.nao_encontrado'],
    [422, 'uniplus.idempotency.body_mismatch'],
    [422, 'uniplus.configuracao.calendario_dias_uteis.descricao_tamanho'],
  ])('a recusa %s %s renova a chave e vai ao alerta', (status, codigo) => {
    expect(classificarFalha(problema(status, codigo))).toEqual({
      tipo: 'geral',
      rotacionarChave: true,
      doServidor: false,
    });
  });

  it('a falha do servidor mantém a chave, pois nada foi gravado, e pede o toast', () => {
    expect(classificarFalha(problema(500, 'uniplus.erro_interno'))).toEqual({
      tipo: 'geral',
      rotacionarChave: false,
      doServidor: true,
    });
  });
});
