import { UnidadePrazo, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { etapasDe } from '../../shared/hidratacao';
import type { FaseDoCronograma, RecursoDaFase } from '../../processo-seletivo.models';
import { comoComandoDeEtapa, comoComandoDeFase, recursoResolvido } from './cronograma-para-comando';

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
    admiteInstanciaSuperior: boolean;
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
              admiteInstanciaSuperior: args.admiteInstanciaSuperior ?? true,
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

describe('avaliação da etapa no ida-e-volta', () => {
  function lida(extra: Record<string, unknown>) {
    const detalhe = detalheComRecursoDaEtapa();
    Object.assign(detalhe.etapas[0] as unknown as Record<string, unknown>, extra);
    return etapasDe(detalhe)[0];
  }

  it('relê e regrava a etapa humana com a regra e o passo', () => {
    const etapa = lida({
      notaMaxima: 10,
      passoDoLancamento: 0.5,
      formaDeAvaliacao: 'HUMANA',
      regraConsolidacao: { codigo: 'CONSOLIDACAO-AVALIACAO-UNICA', versao: 'v1', hash: 'h' },
    });

    expect(etapa.passoDoLancamento).toBe('0.5');
    expect(comoComandoDeEtapa(etapa)).toMatchObject({
      notaMaxima: 10,
      passoDoLancamento: 0.5,
      formaDeAvaliacao: 'HUMANA',
      regraConsolidacaoCodigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
      regraConsolidacaoVersao: 'v1',
    });
  });

  it('a forma objetiva envia regra e passo nulos, ainda que a etapa os carregue', () => {
    const etapa = {
      ...lida({ notaMaxima: 10, formaDeAvaliacao: 'OBJETIVA' }),
      passoDoLancamento: '0.5',
      regraConsolidacaoCodigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
      regraConsolidacaoVersao: 'v1',
    };

    expect(comoComandoDeEtapa(etapa)).toMatchObject({
      formaDeAvaliacao: 'OBJETIVA',
      regraConsolidacaoCodigo: null,
      regraConsolidacaoVersao: null,
      passoDoLancamento: null,
    });
  });

  it('a etapa sem forma envia a forma nula', () => {
    expect(comoComandoDeEtapa(lida({}))).toMatchObject({ formaDeAvaliacao: null });
  });
});

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

  it('envia a declaração de instância superior que o servidor devolveu', () => {
    const admite = comoComandoDeEtapa(
      etapasDe(detalheComRecursoDaEtapa({ admiteInstanciaSuperior: true }))[0],
    );
    const naoAdmite = comoComandoDeEtapa(
      etapasDe(detalheComRecursoDaEtapa({ admiteInstanciaSuperior: false }))[0],
    );

    expect(admite.recursos?.[0]?.admiteInstanciaSuperior).toBe(true);
    expect(naoAdmite.recursos?.[0]?.admiteInstanciaSuperior).toBe(false);
  });

  it('omite o tempo de bloqueio superior da janela que não admite a instância', () => {
    const etapa = etapasDe(
      detalheComRecursoDaEtapa({
        admiteInstanciaSuperior: true,
        suspensividadeSegundaInstanciaValor: 48,
        suspensividadeSegundaInstanciaUnidade: 'horas',
      }),
    )[0];
    const semInstancia = {
      ...etapa,
      recursos: etapa.recursos.map((recurso) => ({ ...recurso, admiteInstanciaSuperior: false })),
    };

    expect(comoComandoDeEtapa(semInstancia).recursos?.[0]).toMatchObject({
      admiteInstanciaSuperior: false,
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

describe('regra de recurso da fase no comando', () => {
  const regraRecurso: RecursoDaFase = {
    regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    regraVersao: 'v1',
    prazoValor: '2',
    prazoUnidade: UnidadePrazo.diasUteis,
    atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
    suspensividadePrimeiraInstanciaValor: '',
    suspensividadePrimeiraInstanciaUnidade: '',
    admiteInstanciaSuperior: true,
    suspensividadeSegundaInstanciaValor: '48',
    suspensividadeSegundaInstanciaUnidade: UnidadePrazo.horas,
  };

  const fase: FaseDoCronograma = {
    faseCanonicaId: '01960000-0000-7000-0000-0000000000f1',
    codigo: 'AVALIACAO',
    ordem: 1,
    inicio: null,
    fim: null,
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso,
    congelados: null,
  };

  it('envia a declaração e o tempo de bloqueio quando a janela admite a instância superior', () => {
    expect(comoComandoDeFase(fase).regraRecurso).toMatchObject({
      admiteInstanciaSuperior: true,
      suspensividadeSegundaInstanciaValor: 48,
      suspensividadeSegundaInstanciaUnidade: 'horas',
    });
  });

  it('omite o tempo de bloqueio superior quando a janela não admite a instância', () => {
    const semInstancia = { ...regraRecurso, admiteInstanciaSuperior: false };

    expect(comoComandoDeFase({ ...fase, regraRecurso: semInstancia }).regraRecurso).toMatchObject({
      admiteInstanciaSuperior: false,
      suspensividadeSegundaInstanciaValor: null,
      suspensividadeSegundaInstanciaUnidade: null,
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
