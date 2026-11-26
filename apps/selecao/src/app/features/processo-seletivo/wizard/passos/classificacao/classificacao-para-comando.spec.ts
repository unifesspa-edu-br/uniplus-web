import { CaraterEtapaCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  EtapaPontuada,
  RegraEliminacaoConfigurada,
  WizardDraft,
} from '../../processo-seletivo.models';
import {
  classificacaoUsaFormulaLocal,
  comoComandoDeClassificacao,
  comoComandoDeRegraEliminacao,
  divisorDaMediaValido,
  eliminacaoAceitaUmaSoVez,
  eliminacaoExigeBaseadoEmEnem,
  exigeResolucaoPesoAreaEnem,
  eliminacaoUsaEtapaENotaMinima,
  eliminacaoUsaSoEtapa,
  eliminacaoUsaAreaEMinimo,
  mensagensDeClassificacaoBase,
} from './classificacao-para-comando';

function classificacaoBase(): WizardDraft['classificacao'] {
  return {
    regraCalculoCodigo: '',
    regraCalculoVersao: '',
    regraArredondamentoCodigo: '',
    regraArredondamentoVersao: '',
    casasArredondamento: '',
    regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
    regraOrdemAlocacaoVersao: '1.0',
    baseadoEmEnem: false,
    escalaNotaFinal: '',
    resolucaoPesoAreaEnem: '',
    regrasEliminacao: [],
    edicoesEnem: [],
  };
}

function regraEliminacao(patch: Partial<RegraEliminacaoConfigurada>): RegraEliminacaoConfigurada {
  return {
    regraCodigo: '',
    regraVersao: '',
    etapaRef: '',
    notaMinima: '',
    minimo: '',
    areaCodigo: '',
    ...patch,
  };
}

function etapa(patch: Partial<EtapaPontuada>): EtapaPontuada {
  return {
    id: 'etapa-1',
    nome: 'Prova objetiva',
    carater: CaraterEtapaCodigo.CLASSIFICATORIA,
    tipoEtapaOrigemId: 'tipo-1',
    peso: '1',
    notaMinima: '',
    ordem: 1,
    faseCodigo: '',
    produtos: [],
    inicio: '',
    fim: '',
    emiteParecerIndividual: false,
    bancas: [],
    recursos: [],
    ...patch,
  };
}

describe('classificacaoUsaFormulaLocal', () => {
  it('é falso para CLASSIFICACAO_IMPORTADA', () => {
    expect(classificacaoUsaFormulaLocal('CLASSIFICACAO_IMPORTADA')).toBe(false);
  });

  it('é falso enquanto nenhuma regra foi escolhida', () => {
    expect(classificacaoUsaFormulaLocal('')).toBe(false);
  });

  it('é verdadeiro para FORMULA_MEDIA_PONDERADA', () => {
    expect(classificacaoUsaFormulaLocal('FORMULA_MEDIA_PONDERADA')).toBe(true);
  });
});

describe('comoComandoDeClassificacao — bimodalidade (INV-B8)', () => {
  it('sob classificação importada, força null nos campos de precisão e vazio na eliminação', () => {
    const classificacao: WizardDraft['classificacao'] = {
      ...classificacaoBase(),
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
      regraCalculoVersao: '1.0',
      // Digitado antes de trocar para importada — não pode vazar no comando.
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regrasEliminacao: [
        regraEliminacao({ regraCodigo: 'ELIMINACAO_ZERO_EM_AREA', regraVersao: '1.0' }),
      ],
    };

    const comando = comoComandoDeClassificacao(classificacao);

    expect(comando.regraArredondamentoCodigo).toBeNull();
    expect(comando.regraArredondamentoVersao).toBeNull();
    expect(comando.casasArredondamento).toBeNull();
    expect(comando.regrasEliminacao).toEqual([]);
  });

  it('sob fórmula local, envia arredondamento, casas e as regras de eliminação', () => {
    const classificacao: WizardDraft['classificacao'] = {
      ...classificacaoBase(),
      regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
      regraCalculoVersao: '1.0',
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regrasEliminacao: [
        regraEliminacao({ regraCodigo: 'ELIMINACAO_ZERO_EM_AREA', regraVersao: '1.0' }),
      ],
    };

    const comando = comoComandoDeClassificacao(classificacao);

    expect(comando.regraArredondamentoCodigo).toBe('ARRED-TRUNCAR');
    expect(comando.regraArredondamentoVersao).toBe('1.0');
    expect(comando.casasArredondamento).toBe(2);
    expect(comando.regrasEliminacao).toHaveLength(1);
  });
});

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

describe('exigeResolucaoPesoAreaEnem — espelha o servidor', () => {
  it('é verdadeiro só com ENEM e média ponderada local', () => {
    expect(
      exigeResolucaoPesoAreaEnem({
        regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
        baseadoEmEnem: true,
      }),
    ).toBe(true);
  });

  it('é falso sem ENEM, com a nota importada ou sem regra escolhida', () => {
    expect(
      exigeResolucaoPesoAreaEnem({
        regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
        baseadoEmEnem: false,
      }),
    ).toBe(false);
    expect(
      exigeResolucaoPesoAreaEnem({
        regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
        baseadoEmEnem: true,
      }),
    ).toBe(false);
    expect(exigeResolucaoPesoAreaEnem({ regraCalculoCodigo: '', baseadoEmEnem: true })).toBe(false);
  });
});

describe('comoComandoDeClassificacao — resolução de Peso por Área', () => {
  const enemLocal = (): WizardDraft['classificacao'] => ({
    ...classificacaoBase(),
    regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: 'ARRED-TRUNCAR',
    regraArredondamentoVersao: '1.0',
    casasArredondamento: '2',
    baseadoEmEnem: true,
    resolucaoPesoAreaEnem: RESOLUCAO,
  });

  it('envia a resolução quando a classificação a exige', () => {
    expect(comoComandoDeClassificacao(enemLocal()).resolucaoPesoAreaEnem).toBe(RESOLUCAO);
  });

  it('envia null fora do ENEM, mesmo com uma escolha anterior guardada no rascunho', () => {
    const semEnem = comoComandoDeClassificacao({ ...enemLocal(), baseadoEmEnem: false });
    const importada = comoComandoDeClassificacao({
      ...enemLocal(),
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
    });

    expect(semEnem.resolucaoPesoAreaEnem).toBeNull();
    expect(importada.resolucaoPesoAreaEnem).toBeNull();
  });

  it('envia null, e não texto vazio, quando a resolução não foi escolhida', () => {
    expect(
      comoComandoDeClassificacao({ ...enemLocal(), resolucaoPesoAreaEnem: '  ' })
        .resolucaoPesoAreaEnem,
    ).toBeNull();
  });
});

describe('escala da nota final no comando', () => {
  const local = (): WizardDraft['classificacao'] => ({
    ...classificacaoBase(),
    regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: 'ARRED-TRUNCAR',
    regraArredondamentoVersao: '1.0',
    casasArredondamento: '2',
  });

  it('envia a escala como número, lida na gramática do campo', () => {
    expect(
      comoComandoDeClassificacao({ ...local(), escalaNotaFinal: '1000' }).escalaNotaFinal,
    ).toBe(1000);
  });

  it('envia null quando o rascunho a deixa vazia', () => {
    expect(comoComandoDeClassificacao(local()).escalaNotaFinal).toBeNull();
  });

  it('sob classificação importada, não envia a escala que o rascunho guarda', () => {
    const comando = comoComandoDeClassificacao({
      ...local(),
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
      escalaNotaFinal: '100',
    });

    expect(comando.escalaNotaFinal).toBeNull();
  });

  it('recusa o texto que não é número, e aceita o campo vazio', () => {
    const comTexto = mensagensDeClassificacaoBase({ ...local(), escalaNotaFinal: 'cem' });

    expect(comTexto.some((mensagem) => mensagem.startsWith('Escala da nota final'))).toBe(true);
    expect(mensagensDeClassificacaoBase(local())).toEqual([]);
  });
});

describe('shape por código de regra de eliminação (DefinirClassificacaoCommandHandler.MontarArgs)', () => {
  it('ELIMINACAO_NOTA_MINIMA_ETAPA usa etapaRef e notaMinima, e minimo e areaCodigo vão null', () => {
    expect(eliminacaoUsaEtapaENotaMinima('ELIMINACAO_NOTA_MINIMA_ETAPA')).toBe(true);
    expect(eliminacaoUsaAreaEMinimo('ELIMINACAO_NOTA_MINIMA_ETAPA')).toBe(false);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIMINACAO_NOTA_MINIMA_ETAPA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        notaMinima: '5',
        minimo: '999', // resíduo de outra escolha — não pode vazar
        areaCodigo: 'REDACAO', // idem
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIMINACAO_NOTA_MINIMA_ETAPA',
      regraVersao: '1.0',
      etapaRef: 'etapa-1',
      notaMinima: 5,
      minimo: null,
      areaCodigo: null,
    });
  });

  it('ELIMINACAO_CORTE_EM_AREA usa areaCodigo e minimo, e etapaRef/notaMinima vão null', () => {
    expect(eliminacaoUsaAreaEMinimo('ELIMINACAO_CORTE_EM_AREA')).toBe(true);
    expect(eliminacaoExigeBaseadoEmEnem('ELIMINACAO_CORTE_EM_AREA')).toBe(true);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIMINACAO_CORTE_EM_AREA',
        regraVersao: 'v1',
        etapaRef: 'etapa-1', // resíduo — não pode vazar
        notaMinima: '5', // resíduo — não pode vazar
        minimo: '400',
        areaCodigo: 'MATEMATICA',
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIMINACAO_CORTE_EM_AREA',
      regraVersao: 'v1',
      etapaRef: null,
      notaMinima: null,
      minimo: 400,
      areaCodigo: 'MATEMATICA',
    });
  });

  it('ELIMINACAO_AUSENCIA_NA_ETAPA usa só etapaRef, sem exigir ENEM', () => {
    expect(eliminacaoUsaSoEtapa('ELIMINACAO_AUSENCIA_NA_ETAPA')).toBe(true);
    expect(eliminacaoUsaEtapaENotaMinima('ELIMINACAO_AUSENCIA_NA_ETAPA')).toBe(false);
    expect(eliminacaoExigeBaseadoEmEnem('ELIMINACAO_AUSENCIA_NA_ETAPA')).toBe(false);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIMINACAO_AUSENCIA_NA_ETAPA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        notaMinima: '5', // resíduo — não pode vazar
        minimo: '400', // idem
        areaCodigo: 'REDACAO', // idem
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIMINACAO_AUSENCIA_NA_ETAPA',
      regraVersao: '1.0',
      etapaRef: 'etapa-1',
      notaMinima: null,
      minimo: null,
      areaCodigo: null,
    });
  });

  it('a regra antiga de corte de redação não tem mais shape reconhecido', () => {
    expect(eliminacaoUsaAreaEMinimo('ELIMINACAO-CORTE-REDACAO')).toBe(false);
  });

  it('ELIMINACAO_FALTA_EM_DIA_DE_PROVA_ENEM exige ENEM, não usa campo e vale uma só vez', () => {
    const codigo = 'ELIMINACAO_FALTA_EM_DIA_DE_PROVA_ENEM';
    expect(eliminacaoUsaEtapaENotaMinima(codigo)).toBe(false);
    expect(eliminacaoUsaAreaEMinimo(codigo)).toBe(false);
    expect(eliminacaoExigeBaseadoEmEnem(codigo)).toBe(true);
    expect(eliminacaoAceitaUmaSoVez(codigo)).toBe(true);
    expect(eliminacaoAceitaUmaSoVez('ELIMINACAO_ZERO_EM_AREA')).toBe(false);
  });

  it('ELIMINACAO_ZERO_EM_AREA não usa nenhum campo', () => {
    expect(eliminacaoUsaEtapaENotaMinima('ELIMINACAO_ZERO_EM_AREA')).toBe(false);
    expect(eliminacaoUsaAreaEMinimo('ELIMINACAO_ZERO_EM_AREA')).toBe(false);
    expect(eliminacaoExigeBaseadoEmEnem('ELIMINACAO_ZERO_EM_AREA')).toBe(true);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIMINACAO_ZERO_EM_AREA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        notaMinima: '5',
        minimo: '400',
        areaCodigo: 'REDACAO',
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIMINACAO_ZERO_EM_AREA',
      regraVersao: '1.0',
      etapaRef: null,
      notaMinima: null,
      minimo: null,
      areaCodigo: null,
    });
  });
});

describe('divisorDaMediaValido', () => {
  it('é falso sem nenhuma etapa', () => {
    expect(divisorDaMediaValido([])).toBe(false);
  });

  it('é falso quando nenhuma etapa compõe a nota', () => {
    expect(
      divisorDaMediaValido([etapa({ carater: CaraterEtapaCodigo.ELIMINATORIA, peso: '1' })]),
    ).toBe(false);
  });

  it('é falso quando a única etapa que pontua tem peso zero', () => {
    expect(
      divisorDaMediaValido([etapa({ carater: CaraterEtapaCodigo.CLASSIFICATORIA, peso: '0' })]),
    ).toBe(false);
  });

  it('é verdadeiro com ao menos uma etapa classificatória de peso positivo', () => {
    expect(
      divisorDaMediaValido([etapa({ carater: CaraterEtapaCodigo.CLASSIFICATORIA, peso: '1' })]),
    ).toBe(true);
  });

  it('é verdadeiro para etapa de caráter "ambas"', () => {
    expect(divisorDaMediaValido([etapa({ carater: CaraterEtapaCodigo.AMBAS, peso: '2' })])).toBe(
      true,
    );
  });
});
