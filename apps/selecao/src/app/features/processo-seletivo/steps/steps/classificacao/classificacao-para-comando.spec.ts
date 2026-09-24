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
  eliminacaoExigeBaseadoEmEnem,
  exigeResolucaoPesoAreaEnem,
  eliminacaoUsaEtapaENotaMinima,
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
    regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
    regraOrdemAlocacaoVersao: '1.0',
    nOpcoesAlocacao: '2',
    baseadoEmEnem: false,
    resolucaoPesoAreaEnem: '',
    regrasEliminacao: [],
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
    carater: 'classificatoria',
    tipoEtapaOrigemId: 'tipo-1',
    peso: '1',
    notaMinima: '',
    ordem: 1,
    ...patch,
  };
}

describe('classificacaoUsaFormulaLocal', () => {
  it('é falso para CLASSIFICACAO-IMPORTADA', () => {
    expect(classificacaoUsaFormulaLocal('CLASSIFICACAO-IMPORTADA')).toBe(false);
  });

  it('é falso enquanto nenhuma regra foi escolhida', () => {
    expect(classificacaoUsaFormulaLocal('')).toBe(false);
  });

  it('é verdadeiro para FORMULA-MEDIA-PONDERADA', () => {
    expect(classificacaoUsaFormulaLocal('FORMULA-MEDIA-PONDERADA')).toBe(true);
  });
});

describe('comoComandoDeClassificacao — bimodalidade (INV-B8)', () => {
  it('sob classificação importada, força null nos campos de precisão e vazio na eliminação', () => {
    const classificacao: WizardDraft['classificacao'] = {
      ...classificacaoBase(),
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraCalculoVersao: '1.0',
      // Digitado antes de trocar para importada — não pode vazar no comando.
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regrasEliminacao: [regraEliminacao({ regraCodigo: 'ELIM-ZERO-EM-AREA', regraVersao: '1.0' })],
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
      regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
      regraCalculoVersao: '1.0',
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regrasEliminacao: [regraEliminacao({ regraCodigo: 'ELIM-ZERO-EM-AREA', regraVersao: '1.0' })],
    };

    const comando = comoComandoDeClassificacao(classificacao);

    expect(comando.regraArredondamentoCodigo).toBe('ARRED-TRUNCAR');
    expect(comando.regraArredondamentoVersao).toBe('1.0');
    expect(comando.casasArredondamento).toBe(2);
    expect(comando.regrasEliminacao).toHaveLength(1);
  });

  it('converte nOpcoesAlocacao de texto para número', () => {
    const comando = comoComandoDeClassificacao({
      ...classificacaoBase(),
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      nOpcoesAlocacao: '1',
    });

    expect(comando.nOpcoesAlocacao).toBe(1);
  });
});

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

describe('exigeResolucaoPesoAreaEnem — espelha o servidor', () => {
  it('é verdadeiro só com ENEM e média ponderada local', () => {
    expect(
      exigeResolucaoPesoAreaEnem({
        regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
        baseadoEmEnem: true,
      }),
    ).toBe(true);
  });

  it('é falso sem ENEM, com a nota importada ou sem regra escolhida', () => {
    expect(
      exigeResolucaoPesoAreaEnem({
        regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
        baseadoEmEnem: false,
      }),
    ).toBe(false);
    expect(
      exigeResolucaoPesoAreaEnem({
        regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
        baseadoEmEnem: true,
      }),
    ).toBe(false);
    expect(exigeResolucaoPesoAreaEnem({ regraCalculoCodigo: '', baseadoEmEnem: true })).toBe(false);
  });
});

describe('comoComandoDeClassificacao — resolução de Peso por Área', () => {
  const enemLocal = (): WizardDraft['classificacao'] => ({
    ...classificacaoBase(),
    regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
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
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
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

describe('shape por código de regra de eliminação (DefinirClassificacaoCommandHandler.MontarArgs)', () => {
  it('ELIM-NOTA-MINIMA-ETAPA usa etapaRef e notaMinima, e minimo e areaCodigo vão null', () => {
    expect(eliminacaoUsaEtapaENotaMinima('ELIM-NOTA-MINIMA-ETAPA')).toBe(true);
    expect(eliminacaoUsaAreaEMinimo('ELIM-NOTA-MINIMA-ETAPA')).toBe(false);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        notaMinima: '5',
        minimo: '999', // resíduo de outra escolha — não pode vazar
        areaCodigo: 'REDACAO', // idem
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
      regraVersao: '1.0',
      etapaRef: 'etapa-1',
      notaMinima: 5,
      minimo: null,
      areaCodigo: null,
    });
  });

  it('ELIM-CORTE-EM-AREA usa areaCodigo e minimo, e etapaRef/notaMinima vão null', () => {
    expect(eliminacaoUsaAreaEMinimo('ELIM-CORTE-EM-AREA')).toBe(true);
    expect(eliminacaoExigeBaseadoEmEnem('ELIM-CORTE-EM-AREA')).toBe(true);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIM-CORTE-EM-AREA',
        regraVersao: 'v1',
        etapaRef: 'etapa-1', // resíduo — não pode vazar
        notaMinima: '5', // resíduo — não pode vazar
        minimo: '400',
        areaCodigo: 'MATEMATICA',
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIM-CORTE-EM-AREA',
      regraVersao: 'v1',
      etapaRef: null,
      notaMinima: null,
      minimo: 400,
      areaCodigo: 'MATEMATICA',
    });
  });

  it('a regra antiga de corte de redação não tem mais shape reconhecido', () => {
    expect(eliminacaoUsaAreaEMinimo('ELIM-CORTE-REDACAO')).toBe(false);
  });

  it('ELIM-ZERO-EM-AREA não usa nenhum campo', () => {
    expect(eliminacaoUsaEtapaENotaMinima('ELIM-ZERO-EM-AREA')).toBe(false);
    expect(eliminacaoUsaAreaEMinimo('ELIM-ZERO-EM-AREA')).toBe(false);
    expect(eliminacaoExigeBaseadoEmEnem('ELIM-ZERO-EM-AREA')).toBe(true);

    const comando = comoComandoDeRegraEliminacao(
      regraEliminacao({
        regraCodigo: 'ELIM-ZERO-EM-AREA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        notaMinima: '5',
        minimo: '400',
        areaCodigo: 'REDACAO',
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'ELIM-ZERO-EM-AREA',
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
    expect(divisorDaMediaValido([etapa({ carater: 'eliminatoria', peso: '1' })])).toBe(false);
  });

  it('é falso quando a única etapa que pontua tem peso zero', () => {
    expect(divisorDaMediaValido([etapa({ carater: 'classificatoria', peso: '0' })])).toBe(false);
  });

  it('é verdadeiro com ao menos uma etapa classificatória de peso positivo', () => {
    expect(divisorDaMediaValido([etapa({ carater: 'classificatoria', peso: '1' })])).toBe(true);
  });

  it('é verdadeiro para etapa de caráter "ambas"', () => {
    expect(divisorDaMediaValido([etapa({ carater: 'ambas', peso: '2' })])).toBe(true);
  });
});

describe('mensagensDeClassificacaoBase', () => {
  const classificacaoCompleta = (): WizardDraft['classificacao'] => ({
    ...classificacaoBase(),
    regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: 'ARRED-TRUNCAR',
    regraArredondamentoVersao: '1.0',
    casasArredondamento: '2',
    regraOrdemAlocacaoCodigo: 'ALOCACAO-OPCOES-RN04',
    regraOrdemAlocacaoVersao: '1.0',
    nOpcoesAlocacao: '2',
  });

  it('sem mensagens quando a base está completa (fórmula local)', () => {
    expect(mensagensDeClassificacaoBase(classificacaoCompleta())).toEqual([]);
  });

  it('recusa sem regra de cálculo escolhida', () => {
    expect(mensagensDeClassificacaoBase(classificacaoBase()).length).toBeGreaterThan(0);
  });

  /**
   * A navegação do wizard é livre: quem chega na Eliminação sem ter
   * preenchido o resto da Fórmula não pode gravar um comando com
   * `regraOrdemAlocacaoCodigo`/`nOpcoesAlocacao` vazios.
   */
  it('recusa sem ordem de alocação, mesmo sob classificação importada', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
    });

    expect(mensagens.some((mensagem) => mensagem.includes('ordem de alocação'))).toBe(true);
  });

  it('recusa sem número de opções válido (1 ou 2)', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      nOpcoesAlocacao: '3',
    });

    expect(mensagens.some((mensagem) => mensagem.includes('número de opções'))).toBe(true);
  });

  it('sob classificação importada, não exige arredondamento nem casas', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
    });

    expect(mensagens).toEqual([]);
  });

  it('recusa a classificação baseada em ENEM com média ponderada sem a resolução', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      baseadoEmEnem: true,
    });

    expect(mensagens).toEqual([
      'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula.',
    ]);
  });

  it('aceita a classificação baseada em ENEM com a resolução escolhida', () => {
    expect(
      mensagensDeClassificacaoBase({
        ...classificacaoCompleta(),
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      }),
    ).toEqual([]);
  });

  it('recusa a resolução que o cadastro lido já não tem, quando quem chama informa', () => {
    const classificacao = {
      ...classificacaoCompleta(),
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    };

    expect(
      mensagensDeClassificacaoBase(classificacao, (resolucao) => resolucao === RESOLUCAO),
    ).toEqual([
      'A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo Fórmula; senão, escolha outra.',
    ]);
    // Sem o predicado, nada foi lido para afirmar que a resolução saiu do cadastro.
    expect(mensagensDeClassificacaoBase(classificacao)).toEqual([]);
  });

  it('não exige a resolução com a nota importada, mesmo marcada como ENEM', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
      baseadoEmEnem: true,
    });

    expect(mensagens).toEqual([]);
  });

  it('sob fórmula local, recusa sem arredondamento ou casas maior que zero', () => {
    const semArredondamento = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
    });
    const comCasasZero = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      casasArredondamento: '0',
    });

    expect(semArredondamento.length).toBeGreaterThan(0);
    expect(comCasasZero.length).toBeGreaterThan(0);
  });
});
