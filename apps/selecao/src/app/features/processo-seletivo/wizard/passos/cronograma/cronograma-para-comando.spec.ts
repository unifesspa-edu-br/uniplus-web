import {
  type EtapaProcessoDto,
  type ProcessoSeletivoDto,
  UnidadePrazoCodigo,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { FaseDoCronograma, RecursoDaFase } from '../../processo-seletivo.models';
import {
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { prazoDaSegundaInstanciaRetirado } from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import {
  PARAMETROS_DO_RECURSO,
  type EtapaDoServidorParcial,
  etapaDoServidor,
  faseDoServidor,
  recursoDaEtapaDoServidor,
} from '../../shared/cronograma-do-servidor.testing';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { etapasDe, hidratarDraft } from '../../shared/hidratacao';
import { DRAFT, dtoComCronograma } from '../../shared/hidratacao.testing';
import { faseDoFormulario, faseRecemAcrescentada, grupoDaFase } from './cronograma-form';
import { comoComandoDeEtapa, comoComandoDeFase, recursoResolvido } from './cronograma-para-comando';

type ParametrosDoRecurso = EtapaProcessoDto['publicacoes']['recursos'][number]['parametros'];

/**
 * O certame como o servidor o devolve, reduzido à etapa e à janela recursal — é o único
 * recorte que estes testes leem, e montar o DTO inteiro só esconderia o que está em jogo.
 */
function detalheComRecursoDaEtapa(
  parametros: Partial<ParametrosDoRecurso> = {},
): ProcessoSeletivoDto {
  const recurso = recursoDaEtapaDoServidor({
    parametros: { ...PARAMETROS_DO_RECURSO, ...parametros },
  });
  return dtoComCronograma({
    etapas: [
      etapaDoServidor({
        id: '01960000-0000-7000-0000-0000000000e1',
        identificacao: { faseCodigo: 'AVALIACAO' },
        publicacoes: { recursos: [recurso] },
      }),
    ],
  });
}

describe('avaliação da etapa no ida-e-volta', () => {
  function lida(parcial: EtapaDoServidorParcial) {
    return etapasDe(dtoComCronograma({ etapas: [etapaDoServidor(parcial)] }))[0];
  }

  it('relê e regrava a etapa humana com a regra e o passo', () => {
    const etapa = lida({
      nota: { notaMaxima: 10, passoDoLancamento: 0.5 },
      avaliacao: {
        formaDeAvaliacao: 'HUMANA',
        regraConsolidacao: { codigo: 'CONSOLIDACAO-AVALIACAO-UNICA', versao: 'v1', hash: 'h' },
      },
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
      ...lida({ nota: { notaMaxima: 10 }, avaliacao: { formaDeAvaliacao: 'OBJETIVA' } }),
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

  it('relê os itens com o id e a escala em percentual, e regrava a fração', () => {
    const etapa = lida({
      nota: { notaMaxima: 10 },
      avaliacao: {
        formaDeAvaliacao: 'HUMANA',
        itensDeAvaliacao: [
          { id: '01960000-0000-7000-0000-0000000000i1', rotulo: 'Clareza', pontuacaoMaxima: 4 },
        ],
        escalaDeAtendimento: [
          { rotulo: 'Atendeu', fracao: 1 },
          { rotulo: 'Parcial', fracao: 0.5 },
        ],
      },
    });

    expect(etapa.escalaDeAtendimento?.map((nivel) => nivel.percentual)).toEqual(['100', '50']);
    expect(comoComandoDeEtapa(etapa)).toMatchObject({
      itensDeAvaliacao: [
        { id: '01960000-0000-7000-0000-0000000000i1', rotulo: 'Clareza', pontuacaoMaxima: 4 },
      ],
      escalaDeAtendimento: [
        { rotulo: 'Atendeu', fracao: 1 },
        { rotulo: 'Parcial', fracao: 0.5 },
      ],
    });
  });

  it('o item novo vai sem id', () => {
    const etapa = {
      ...lida({ nota: { notaMaxima: 10 } }),
      itensDeAvaliacao: [{ id: null, rotulo: ' Método ', pontuacaoMaxima: '6,5' }],
    };

    expect(comoComandoDeEtapa(etapa).itensDeAvaliacao).toEqual([
      { id: null, rotulo: 'Método', pontuacaoMaxima: 6.5 },
    ]);
  });

  it('a etapa sem forma envia a forma nula', () => {
    expect(comoComandoDeEtapa(lida({}))).toMatchObject({ formaDeAvaliacao: null });
  });
});

describe('recurso da etapa no ida-e-volta', () => {
  /**
   * Os parâmetros do recurso são guardados pelo servidor e devolvidos na leitura: bastava a pessoa
   * mexer numa data do cronograma para o que ela declarou desaparecer, se o envio não os levasse.
   */
  it('preserva os parâmetros do recurso ao reler e regravar', () => {
    const etapa = etapasDe(detalheComRecursoDaEtapa())[0];

    expect(comoComandoDeEtapa(etapa).recursos?.[0]).toMatchObject({
      prazoValor: 2,
      prazoUnidade: 'diasUteis',
      admiteInstanciaSuperior: true,
      prazoSegundaInstanciaValor: 3,
      prazoSegundaInstanciaUnidade: 'diasUteis',
      efeitoSuspensivo: 'semEfeitoSuspensivo',
      guardaDaVaga: 'ateOResultadoDefinitivo',
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

  it('envia o prazo da 2ª instância lido sem instância superior até a pessoa retirá-lo', () => {
    const etapa = etapasDe(detalheComRecursoDaEtapa({ admiteInstanciaSuperior: false }))[0];

    expect(comoComandoDeEtapa(etapa).recursos?.[0]).toMatchObject({
      admiteInstanciaSuperior: false,
      prazoSegundaInstanciaValor: 3,
      prazoSegundaInstanciaUnidade: 'diasUteis',
    });
  });

  it('envia nulo no prazo da 2ª instância depois de retirado', () => {
    const etapa = etapasDe(detalheComRecursoDaEtapa({ admiteInstanciaSuperior: false }))[0];
    const [recurso] = etapa.recursos;
    const { parametros, leitura } = prazoDaSegundaInstanciaRetirado(recurso, recurso.leitura);

    const retirado = { ...etapa, recursos: [{ ...recurso, ...parametros, leitura }] };

    expect(comoComandoDeEtapa(retirado).recursos?.[0]).toMatchObject({
      prazoSegundaInstanciaValor: null,
      prazoSegundaInstanciaUnidade: null,
    });
  });

  it('lê o código de efeito que o vocabulário atual não conhece e o devolve sem trocá-lo', () => {
    const etapa = etapasDe(
      detalheComRecursoDaEtapa({
        efeitoSuspensivo: { codigo: 'efeitoDoFuturo' as never, rotulo: 'Efeito do futuro' },
      }),
    )[0];

    expect(comoComandoDeEtapa(etapa).recursos?.[0]?.efeitoSuspensivo).toBe('efeitoDoFuturo');
  });

  /** O prazo e a âncora continuam onde estavam. */
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

describe('fase no comando', () => {
  const regraRecurso: RecursoDaFase = {
    regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    regraVersao: 'v1',
    atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
    ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
    prazoSegundaInstanciaValor: '48',
    prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.horas,
    leitura: umaLeituraDoRecurso(),
    procedimentos: [],
  };

  const fase: FaseDoCronograma = umaFaseDoCronograma({
    faseCanonicaId: '01960000-0000-7000-0000-0000000000f1',
    regraRecurso,
  });

  it('envia a unidade responsável da fase, e nula quando ela não tem', () => {
    expect(
      comoComandoDeFase({ ...fase, unidadeResponsavelId: 'unidade-cga' }).unidadeResponsavelId,
    ).toBe('unidade-cga');
    expect(comoComandoDeFase(fase).unidadeResponsavelId).toBeNull();
  });

  it('envia a regra de recurso com os parâmetros, a regra, a âncora e os procedimentos', () => {
    expect(comoComandoDeFase(fase).regraRecurso).toEqual({
      regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
      regraVersao: 'v1',
      atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
      prazoValor: 2,
      prazoUnidade: 'diasUteis',
      admiteInstanciaSuperior: true,
      prazoSegundaInstanciaValor: 48,
      prazoSegundaInstanciaUnidade: 'horas',
      efeitoSuspensivo: 'semEfeitoSuspensivo',
      guardaDaVaga: 'ateOResultadoDefinitivo',
      procedimentos: [],
    });
  });

  it('a fase sem regra de recurso envia a regra nula', () => {
    expect(comoComandoDeFase({ ...fase, regraRecurso: null }).regraRecurso).toBeNull();
  });
});

describe('momento da fase em relação à anterior, no ida-e-volta', () => {
  const comMomento = (noMesmoMomentoDaAnterior: boolean): ProcessoSeletivoDto =>
    dtoComCronograma({
      cronogramaFases: [faseDoServidor({ cronograma: { noMesmoMomentoDaAnterior } })],
      etapas: [],
    });

  it.each([true, false])(
    'devolve no comando o valor %s que a leitura trouxe, sem a pessoa tocar nele',
    (marca) => {
      const [fase] = hidratarDraft(DRAFT, comMomento(marca)).cronograma.fases;

      expect(comoComandoDeFase(fase).noMesmoMomentoDaAnterior).toBe(marca);
    },
  );

  it('mantém o valor ao mudar uma data da fase e passar pelo formulário do cronograma', () => {
    const [fase] = hidratarDraft(DRAFT, comMomento(true)).cronograma.fases;
    const grupo = grupoDaFase(fase);

    grupo.controls.inicio.setValue('2026-04-01T08:00');

    expect(comoComandoDeFase(faseDoFormulario(grupo)).noMesmoMomentoDaAnterior).toBe(true);
  });

  it('a fase acrescentada pela pessoa nasce sem a marca', () => {
    const nova = faseRecemAcrescentada({
      faseCanonicaId: 'fase-nova',
      codigo: 'NOVA',
      ordem: 3,
      unidadeResponsavelId: null,
    });

    expect(comoComandoDeFase(nova).noMesmoMomentoDaAnterior).toBe(false);
  });
});

describe('recursoResolvido', () => {
  it('reprova recurso cujo catálogo ainda não resolveu a regra', () => {
    expect(recursoResolvido({ regraCodigo: '', regraVersao: '' })).toBe(false);
    expect(recursoResolvido({ regraCodigo: 'RECURSO-X', regraVersao: '' })).toBe(false);
    expect(recursoResolvido({ regraCodigo: '', regraVersao: '1.0.0' })).toBe(false);
  });

  it('aprova recurso com código e versão', () => {
    expect(recursoResolvido({ regraCodigo: 'RECURSO-X', regraVersao: '1.0.0' })).toBe(true);
  });
});
