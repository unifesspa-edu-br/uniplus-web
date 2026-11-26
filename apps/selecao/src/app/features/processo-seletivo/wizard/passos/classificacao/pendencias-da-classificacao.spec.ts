import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { WizardDraft } from '../../processo-seletivo.models';
import {
  mensagensDeClassificacaoBase,
  pendenciasDaClassificacaoBase,
} from './classificacao-para-comando';

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

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

describe('mensagensDeClassificacaoBase', () => {
  const classificacaoCompleta = (): WizardDraft['classificacao'] => ({
    ...classificacaoBase(),
    regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
    regraCalculoVersao: '1.0',
    regraArredondamentoCodigo: 'ARRED-TRUNCAR',
    regraArredondamentoVersao: '1.0',
    casasArredondamento: '2',
    regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
    regraOrdemAlocacaoVersao: '1.0',
  });

  it('nomeia o campo de cada pendência, na ordem em que a tela os mostra', () => {
    const pendencias = pendenciasDaClassificacaoBase({
      ...classificacaoCompleta(),
      regraArredondamentoCodigo: '',
      casasArredondamento: '0',
      regraOrdemAlocacaoCodigo: '',
    });

    expect(pendencias.map((pendencia) => pendencia.campo)).toEqual([
      'regraArredondamento',
      'casasArredondamento',
      'regraOrdemAlocacao',
    ]);
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
   * `regraOrdemAlocacaoCodigo` vazio.
   */
  it('recusa sem ordem de alocação, mesmo sob classificação importada', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
    });

    expect(mensagens.some((mensagem) => mensagem.includes('ordem de alocação'))).toBe(true);
  });

  it('sob classificação importada, não exige arredondamento nem casas', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
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
      `Selecione a resolução de Peso por Área usada na nota, no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
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
      `A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo ${NOME_DO_PASSO_DA_FORMULA}; senão, escolha outra.`,
    ]);
    // Sem o predicado, nada foi lido para afirmar que a resolução saiu do cadastro.
    expect(mensagensDeClassificacaoBase(classificacao)).toEqual([]);
  });

  it('não exige a resolução com a nota importada, mesmo marcada como ENEM', () => {
    const mensagens = mensagensDeClassificacaoBase({
      ...classificacaoCompleta(),
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
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
