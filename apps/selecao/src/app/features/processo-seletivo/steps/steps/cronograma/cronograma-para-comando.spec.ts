import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { etapasDe } from '../../shared/hidratacao';
import { comoComandoDeEtapa, recursoResolvido } from './cronograma-para-comando';

/**
 * O certame como o servidor o devolve, reduzido à etapa e à janela recursal — é o único
 * recorte que estes testes leem, e montar o DTO inteiro só esconderia o que está em jogo.
 */
function detalheComRecursoDaEtapa(
  args: Partial<{
    prazoValor: number;
    prazoUnidade: string;
    suspensividadePrimeiraInstanciaValor: number | null;
    suspensividadePrimeiraInstanciaUnidade: string | null;
    suspensividadeSegundaInstanciaValor: number | null;
    suspensividadeSegundaInstanciaUnidade: string | null;
  }> = {},
): ProcessoSeletivoDto {
  return {
    etapas: [
      {
        id: '01960000-0000-7000-0000-0000000000e1',
        nome: 'Prova Objetiva',
        carater: 'classificatoria',
        tipoEtapa: { origemId: '01960000-0000-7000-0000-0000000000t1' },
        peso: 2,
        notaMinima: null,
        ordem: 1,
        faseCodigo: 'AVALIACAO',
        produtos: [],
        inicio: null,
        fim: null,
        emiteParecerIndividual: false,
        bancas: [],
        recursos: [
          {
            id: '01960000-0000-7000-0000-0000000000r1',
            ancora: 'atoPublicado',
            regra: { codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO', versao: '1.0.0' },
            args: {
              prazoValor: args.prazoValor ?? 2,
              prazoUnidade: args.prazoUnidade ?? 'diasUteis',
              suspensividadePrimeiraInstanciaValor:
                args.suspensividadePrimeiraInstanciaValor ?? null,
              suspensividadePrimeiraInstanciaUnidade:
                args.suspensividadePrimeiraInstanciaUnidade ?? null,
              suspensividadeSegundaInstanciaValor: args.suspensividadeSegundaInstanciaValor ?? null,
              suspensividadeSegundaInstanciaUnidade:
                args.suspensividadeSegundaInstanciaUnidade ?? null,
            },
            produtoAncoraId: '01960000-0000-7000-0000-0000000000p1',
            atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
          },
        ],
      },
    ],
  } as unknown as ProcessoSeletivoDto;
}

describe('recurso da etapa no ida-e-volta', () => {
  /**
   * O efeito suspensivo é persistido pelo servidor em colunas próprias e devolvido na
   * leitura. Antes deste fix o rascunho não tinha onde guardá-lo e o mapeador mandava `null`
   * fixo nos quatro campos: bastava o operador mexer numa data do cronograma para a
   * suspensividade declarada desaparecer, sem tela que a mostrasse e sem recusa que a
   * defendesse.
   */
  it('preserva a suspensividade das duas instâncias ao reler e regravar', () => {
    const etapa = etapasDe(
      detalheComRecursoDaEtapa({
        suspensividadePrimeiraInstanciaValor: 3,
        suspensividadePrimeiraInstanciaUnidade: 'diasUteis',
        suspensividadeSegundaInstanciaValor: 48,
        suspensividadeSegundaInstanciaUnidade: 'horas',
      }),
    )[0];

    expect(etapa.recursos[0].suspensividadePrimeiraInstanciaValor).toBe('3');
    expect(etapa.recursos[0].suspensividadePrimeiraInstanciaUnidade).toBe('diasUteis');
    expect(etapa.recursos[0].suspensividadeSegundaInstanciaValor).toBe('48');
    expect(etapa.recursos[0].suspensividadeSegundaInstanciaUnidade).toBe('horas');

    const comando = comoComandoDeEtapa(etapa);
    expect(comando.recursos?.[0]).toMatchObject({
      suspensividadePrimeiraInstanciaValor: 3,
      suspensividadePrimeiraInstanciaUnidade: 'diasUteis',
      suspensividadeSegundaInstanciaValor: 48,
      suspensividadeSegundaInstanciaUnidade: 'horas',
    });
  });

  /** Instância sem suspensividade continua viajando como ausência declarada, não como zero. */
  it('mantém em branco a instância que não declara suspensividade', () => {
    const etapa = etapasDe(
      detalheComRecursoDaEtapa({
        suspensividadePrimeiraInstanciaValor: 3,
        suspensividadePrimeiraInstanciaUnidade: 'diasUteis',
      }),
    )[0];

    const comando = comoComandoDeEtapa(etapa);
    expect(comando.recursos?.[0]).toMatchObject({
      suspensividadePrimeiraInstanciaValor: 3,
      suspensividadeSegundaInstanciaValor: null,
      suspensividadeSegundaInstanciaUnidade: null,
    });
  });

  /** O prazo e a âncora continuam onde estavam — o fix não podia mexer no que já funcionava. */
  it('não altera prazo nem âncora', () => {
    const etapa = etapasDe(detalheComRecursoDaEtapa({ prazoValor: 5 }))[0];
    const comando = comoComandoDeEtapa(etapa);

    expect(comando.recursos?.[0]).toMatchObject({
      ancora: 'atoPublicado',
      regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
      prazoValor: 5,
      prazoUnidade: 'diasUteis',
      atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
    });
  });
});

describe('recursoResolvido', () => {
  it('reprova janela cujo catálogo ainda não resolveu a regra', () => {
    expect(recursoResolvido({ regraCodigo: '', regraVersao: '' })).toBe(false);
    expect(recursoResolvido({ regraCodigo: 'RECURSO-X', regraVersao: '' })).toBe(false);
    expect(recursoResolvido({ regraCodigo: '', regraVersao: '1.0.0' })).toBe(false);
  });

  it('aprova janela com código e versão', () => {
    expect(recursoResolvido({ regraCodigo: 'RECURSO-X', regraVersao: '1.0.0' })).toBe(true);
  });
});
