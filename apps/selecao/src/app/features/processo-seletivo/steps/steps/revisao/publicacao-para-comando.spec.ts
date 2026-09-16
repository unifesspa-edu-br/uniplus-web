import { ProblemDetails } from '@uniplus/shared-core/http';
import { ItemConformidadeDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { PASSOS } from '../../processo-seletivo.data';
import { FaseDoCronograma, WizardDraft } from '../../processo-seletivo.models';
import {
  agruparPorDimensao,
  comExtensoesDePublicacao,
  comoComandoDePublicacao,
  dataReferenciaLegalDe,
  eErroDeDocumentoOuAto,
  faseQueAncoraOPeriodoDeInscricao,
  mensagensDePublicacao,
  ondeResolverItem,
  passoDoItem,
  rotuloDaDimensao,
  rotuloDoPasso,
  temFaseDeColetaInscricao,
} from './publicacao-para-comando';

const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000518';

function draftVazio(): WizardDraft {
  return {
    tipoProcesso: { selected: '', rotulo: '' },
    pagamento: { cobra: null, valor: '', fundamentos: [] },
    identificacao: {
      nome: '',
      unidadeAdministradoraId: '',
      origemCandidatos: '',
      localidade: null,
      uploads: [],
    },
    vagas: { ofertas: [] },
    cronograma: { fases: [], etapas: [], algoritmoContagemCodigo: '', algoritmoContagemVersao: '' },
    classificacao: {
      regraCalculoCodigo: '',
      regraCalculoVersao: '',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
      nOpcoesAlocacao: '',
      baseadoEmEnem: false,
      regrasEliminacao: [],
    },
    bonus: {
      ativo: false,
      regraCodigo: '',
      regraVersao: '',
      fator: '',
      teto: '',
      baseLegalBonusRegionalId: '',
    },
    desempate: [],
    documentos: {},
    atendimento: { condicoes: [], recursos: [], tiposDeficiencia: [] },
    publicacao: {
      numero: '',
      periodoInscricaoInicio: '',
      periodoInscricaoFim: '',
      ato: { orgao: '', serie: '', ano: '', dataPublicacao: '', assinante: '', tipoAtoCodigo: '' },
    },
  };
}

function fase(parcial: Partial<FaseDoCronograma> & { ordem: number }): FaseDoCronograma {
  return {
    faseCanonicaId: `fase-${parcial.ordem}`,
    codigo: `FASE-${parcial.ordem}`,
    ordem: parcial.ordem,
    inicio: null,
    fim: null,
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso: null,
    congelados: null,
    ...parcial,
  };
}

function atoCompleto(): WizardDraft['publicacao']['ato'] {
  return {
    orgao: 'Reitoria',
    serie: '1',
    ano: '2027',
    dataPublicacao: '2027-01-15',
    assinante: 'Reitor',
    tipoAtoCodigo: 'PORTARIA',
  };
}

describe('faseQueAncoraOPeriodoDeInscricao / temFaseDeColetaInscricao', () => {
  it('devolve null quando nenhuma fase coleta inscrição', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({ ordem: 1, congelados: { ...congeladosBase, coletaInscricao: false } }),
    ];

    expect(faseQueAncoraOPeriodoDeInscricao(draft)).toBeNull();
    expect(temFaseDeColetaInscricao(draft)).toBe(false);
  });

  it('elege a fase de MENOR ordem entre as que coletam — duas fases de coleta não é problema da tela', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({
        ordem: 2,
        codigo: 'REMANEJAMENTO',
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-02-01T00:00:00Z',
        fim: '2027-02-10T23:59:59Z',
      }),
      fase({
        ordem: 1,
        codigo: 'INSCRICAO',
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-01-01T00:00:00Z',
        fim: '2027-01-31T23:59:59Z',
      }),
    ];

    const ancora = faseQueAncoraOPeriodoDeInscricao(draft);
    expect(ancora?.codigo).toBe('INSCRICAO');
    expect(temFaseDeColetaInscricao(draft)).toBe(true);
  });
});

const congeladosBase = {
  donoTipico: '',
  origemData: '',
  agrupaEtapas: false,
  coletaInscricao: false,
  permiteComplementacao: false,
  coletaSolicitacaoIsencao: false,
  bancas: [],
};

describe('comoComandoDePublicacao — ARMADILHA do período (#486)', () => {
  it('com fase de coleta, envia NULL nos dois campos de período mesmo que o rascunho tenha algo digitado', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({
        ordem: 1,
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-01-01T00:00:00Z',
        fim: '2027-01-31T23:59:59Z',
      }),
    ];
    draft.publicacao = {
      numero: '001/2027',
      // Preenchido de propósito — o mapeador tem de IGNORAR e mandar null,
      // nunca vazar um valor que o servidor recusaria com 422.
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
    };

    const comando = comoComandoDePublicacao(draft, DOCUMENTO_ID);

    expect(comando.periodoInscricaoInicio).toBeNull();
    expect(comando.periodoInscricaoFim).toBeNull();
  });

  it('sem fase de coleta, envia os dois campos como instante ISO do fuso institucional', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
    };

    const comando = comoComandoDePublicacao(draft, DOCUMENTO_ID);

    expect(comando.periodoInscricaoInicio).not.toBeNull();
    expect(comando.periodoInscricaoInicio).toMatch(/^2027-05-01T08:00:00[+-]\d{2}:\d{2}$/);
    expect(comando.periodoInscricaoFim).toMatch(/^2027-05-10T18:00:00[+-]\d{2}:\d{2}$/);
  });

  it('número vazio vira null; documentoEditalId e ato viajam como informados', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '   ',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
    };

    const comando = comoComandoDePublicacao(draft, DOCUMENTO_ID);

    expect(comando.numero).toBeNull();
    expect(comando.documentoEditalId).toBe(DOCUMENTO_ID);
    expect(comando.ato).toEqual({
      orgao: 'Reitoria',
      serie: '1',
      ano: 2027,
      dataPublicacao: '2027-01-15',
      assinante: 'Reitor',
      tipoAtoCodigo: 'PORTARIA',
    });
  });
});

describe('dataReferenciaLegalDe', () => {
  it('usa o início da fase de coleta quando ela já tem janela', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({
        ordem: 1,
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-01-01T02:00:00Z',
        fim: '2027-01-31T23:59:59Z',
      }),
    ];

    expect(dataReferenciaLegalDe(draft)).toBe('2026-12-31');
  });

  it('devolve null quando a fase de coleta ainda não tem janela', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({ ordem: 1, congelados: { ...congeladosBase, coletaInscricao: true } }),
    ];

    expect(dataReferenciaLegalDe(draft)).toBeNull();
  });

  it('sem fase de coleta, usa o que o operador informou no campo desta tela', () => {
    const draft = draftVazio();
    draft.publicacao.periodoInscricaoInicio = '2027-03-10T09:00';

    expect(dataReferenciaLegalDe(draft)).toBe('2027-03-10');
  });

  it('sem fase de coleta e sem campo preenchido, devolve null', () => {
    expect(dataReferenciaLegalDe(draftVazio())).toBeNull();
  });
});

describe('agruparPorDimensao', () => {
  it('agrupa preservando a ordem de primeira aparição e marca ok só quando TODOS os itens do grupo são ok', () => {
    const itens: ItemConformidadeDto[] = [
      { codigo: 'a', dimensao: 'taxa_inscricao', mensagem: 'x', ok: true },
      { codigo: 'b', dimensao: 'classificacao', mensagem: 'y', ok: false },
      { codigo: 'c', dimensao: 'taxa_inscricao', mensagem: 'z', ok: false },
    ];

    const grupos = agruparPorDimensao(itens);

    expect(grupos.map((g) => g.dimensao)).toEqual(['taxa_inscricao', 'classificacao']);
    expect(grupos[0].ok).toBe(false);
    expect(grupos[0].itens).toHaveLength(2);
    expect(grupos[1].ok).toBe(false);
  });

  it('grupo com todos os itens ok fica ok', () => {
    const itens: ItemConformidadeDto[] = [
      { codigo: 'a', dimensao: 'cronograma', mensagem: 'x', ok: true },
      { codigo: 'b', dimensao: 'cronograma', mensagem: 'y', ok: true },
    ];

    expect(agruparPorDimensao(itens)[0].ok).toBe(true);
  });
});

describe('rotuloDaDimensao', () => {
  it('troca sublinhado por espaço e capitaliza só a primeira letra — sem tabela de tradução', () => {
    expect(rotuloDaDimensao('taxa_inscricao')).toBe('Taxa inscricao');
    expect(rotuloDaDimensao('atendimento_especializado')).toBe('Atendimento especializado');
  });
});

describe('passoDoItem', () => {
  /**
   * O rótulo do passo, e não o índice, é o que se afirma aqui: o índice literal já se
   * desalinhou quando "Locais de prova" saiu do wizard, e um teste escrito contra o índice
   * teria acompanhado o erro em vez de apanhá-lo.
   */
  function rotuloDoItem(codigo: string, dimensao: string): string | null {
    const passo = passoDoItem(codigo, dimensao);
    return passo === null ? null : PASSOS[passo].rotulo;
  }

  it('leva cada dimensão ao passo que a grava', () => {
    expect(rotuloDoItem('taxa_inscricao_nao_declarada', 'taxa_inscricao')).toBe('Pagamento');
    expect(rotuloDoItem('distribuicao_vagas_ausente', 'distribuicao_vagas')).toBe('Vagas');
    expect(rotuloDoItem('cascata_pendente', 'cascata_remanejamento')).toBe('Vagas');
    expect(rotuloDoItem('cronograma_fases_ausente', 'cronograma')).toBe('Cronograma');
    expect(rotuloDoItem('algoritmo_contagem_prazo_nao_declarado', 'contagem_de_prazos')).toBe(
      'Cronograma',
    );
    expect(rotuloDoItem('classificacao_ausente', 'classificacao')).toBe('Eliminação');
    expect(
      rotuloDoItem('atendimento_especializado_ausente', 'atendimento_especializado'),
    ).toBe('Atend. especial');
  });

  /** A exigência documental é declarada na superfície da fase, dentro do passo do cronograma. */
  it('leva ao cronograma a pendência de exigência documental', () => {
    expect(rotuloDoItem('exigencias_base_legal_nao_resolvida', 'exigencias_documentais')).toBe(
      'Cronograma',
    );
  });

  /**
   * Os fatos coletados, as regras de derivação e a âncora da apuração de idade são declarados
   * no formulário de inscrição — antes de ele existir como passo, esta dimensão inteira ficava
   * sem destino e o operador lia a pendência sem ter para onde ir.
   */
  it('leva ao formulário de inscrição a pendência de coleta de fatos', () => {
    expect(rotuloDoItem('derivacao_fatos_citados_inexistentes', 'coleta_de_fatos')).toBe(
      'Formulário',
    );
    expect(rotuloDoItem('referencia_temporal_ausente_com_gatilho_etario', 'coleta_de_fatos')).toBe(
      'Formulário',
    );
    expect(rotuloDoItem('grafo_dependencia_com_ciclo', 'coleta_de_fatos')).toBe('Formulário');
  });

  /**
   * A decisão é por item, não por dimensão: escolher QUAL fase ancora a apuração da idade é do
   * formulário, mas dar data à fase escolhida é do cronograma. Mandar quem tem fase sem data
   * para o formulário mostraria a âncora já declarada, sem nada a corrigir ali.
   */
  it('manda ao cronograma o que depende da data da fase, e ao atendimento o que depende da oferta', () => {
    expect(rotuloDoItem('referencia_temporal_extremo_da_fase_ausente', 'coleta_de_fatos')).toBe(
      'Cronograma',
    );
    expect(rotuloDoItem('referencia_temporal_fim_inscricao_indisponivel', 'coleta_de_fatos')).toBe(
      'Cronograma',
    );
    expect(rotuloDoItem('fato_coletavel_sem_valores_ofertados', 'coleta_de_fatos')).toBe(
      'Atend. especial',
    );
  });

  /**
   * Os três itens de contagem de prazos que o cronograma não resolve. Antes da decisão por
   * item eles herdavam o passo da dimensão e ofereciam "Ir para Cronograma", onde não há
   * nada sobre calendário, localidade nem fuso.
   */
  it('não oferece passo para o que se resolve fora do wizard, e diz onde se resolve', () => {
    for (const codigo of [
      'calendario_vigente_ausente',
      'localidade_nao_declarada',
      'fuso_institucional_nao_reconhecido',
    ]) {
      expect(passoDoItem(codigo, 'contagem_de_prazos')).toBeNull();
      expect(ondeResolverItem(codigo)).not.toBeNull();
    }

    expect(ondeResolverItem('calendario_vigente_ausente')).toContain('Configuração');
  });

  it('não diz "onde resolver" para item que tem passo', () => {
    expect(ondeResolverItem('cronograma_fases_ausente')).toBeNull();
    expect(ondeResolverItem('algoritmo_contagem_prazo_nao_declarado')).toBeNull();
  });

  /**
   * O defeito que motivou trocar o índice literal pelo rótulo: todo destino do mapa tem de
   * existir em PASSOS. Um passo retirado ou renomeado quebra aqui, e não em produção.
   */
  it('todo destino do mapa resolve para um passo existente', () => {
    const dimensoes = [
      ['taxa_inscricao_nao_declarada', 'taxa_inscricao'],
      ['distribuicao_vagas_ausente', 'distribuicao_vagas'],
      ['cascata_pendente', 'cascata_remanejamento'],
      ['cronograma_fases_ausente', 'cronograma'],
      ['exigencias_base_legal_nao_resolvida', 'exigencias_documentais'],
      ['algoritmo_contagem_prazo_nao_declarado', 'contagem_de_prazos'],
      ['classificacao_ausente', 'classificacao'],
      ['atendimento_especializado_ausente', 'atendimento_especializado'],
      ['derivacao_fatos_citados_inexistentes', 'coleta_de_fatos'],
      ['referencia_temporal_extremo_da_fase_ausente', 'coleta_de_fatos'],
      ['fato_coletavel_sem_valores_ofertados', 'coleta_de_fatos'],
    ] as const;

    for (const [codigo, dimensao] of dimensoes) {
      const passo = passoDoItem(codigo, dimensao);
      expect(passo, `dimensão ${dimensao} sem passo resolvido`).not.toBeNull();
      expect(passo).toBeGreaterThanOrEqual(0);
      expect(passo).toBeLessThan(PASSOS.length);
    }
  });

  /** O painel nomeia o passo, não a dimensão — é o nome que o operador reconhece na lista. */
  it('nomeia o passo pelo rótulo de revisão', () => {
    function nomeDoPasso(codigo: string, dimensao: string): string | null {
      const passo = passoDoItem(codigo, dimensao);
      return passo === null ? null : rotuloDoPasso(passo);
    }

    expect(nomeDoPasso('taxa_inscricao_nao_declarada', 'taxa_inscricao')).toBe(
      'Taxa de inscrição',
    );
    expect(nomeDoPasso('cronograma_fases_ausente', 'cronograma')).toBe('Cronograma e etapas');
  });
});

describe('mensagensDePublicacao', () => {
  it('cobra documento, os dois campos de período sem fase de coleta, e cada campo do ato', () => {
    const draft = draftVazio();

    const mensagens = mensagensDePublicacao(draft, null);

    expect(mensagens).toContain(
      'Escolha o documento do edital confirmado que será publicado, na Identificação.',
    );
    expect(mensagens.some((m) => m.includes('início do período'))).toBe(true);
    expect(mensagens.some((m) => m.includes('fim do período'))).toBe(true);
    expect(mensagens.some((m) => m.includes('órgão'))).toBe(true);
    expect(mensagens.some((m) => m.includes('tipo'))).toBe(true);
  });

  it('não cobra período quando há fase de coleta', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({ ordem: 1, congelados: { ...congeladosBase, coletaInscricao: true } }),
    ];

    const mensagens = mensagensDePublicacao(draft, DOCUMENTO_ID);

    expect(mensagens.some((m) => m.includes('período'))).toBe(false);
  });

  /**
   * Ano zero atravessava a conferência porque `0` é número válido — e só era recusado pelo
   * servidor, depois de o operador confirmar a publicação num diálogo que exibia "Ano: 0".
   * Publicar é o único clique do wizard que não se desfaz.
   */
  it('cobra o ano do ato quando ele é zero, não só quando está vazio', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: { ...atoCompleto(), ano: '0' },
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toContain(
      'Informe o ano do ato de publicação.',
    );
  });

  it('acusa o período de inscrição invertido antes de publicar', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-10T18:00',
      periodoInscricaoFim: '2027-05-01T08:00',
      ato: atoCompleto(),
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toContain(
      'O fim do período de inscrição não pode anteceder o início.',
    );
  });

  /** Os limites são de coluna: o nome de um órgão com a hierarquia inteira passa de 200. */
  it('acusa o campo do ato que passa do limite do registro', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: 'N'.repeat(61),
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: { ...atoCompleto(), orgao: 'O'.repeat(201) },
    };

    const mensagens = mensagensDePublicacao(draft, DOCUMENTO_ID);

    expect(mensagens).toContain('O número do ato passa de 60 caracteres, que é o limite do registro.');
    expect(mensagens).toContain('O órgão do ato passa de 200 caracteres, que é o limite do registro.');
  });

  it('vazio quando documento escolhido, ato completo e período preenchido', () => {
    const draft = draftVazio();
    draft.publicacao = {
      numero: '',
      periodoInscricaoInicio: '2027-05-01T08:00',
      periodoInscricaoFim: '2027-05-10T18:00',
      ato: atoCompleto(),
    };

    expect(mensagensDePublicacao(draft, DOCUMENTO_ID)).toEqual([]);
  });
});

describe('eErroDeDocumentoOuAto', () => {
  it('reconhece os códigos nomeados que nenhum dos dois checklists cobre', () => {
    expect(eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.documento_nao_confirmado')).toBe(true);
    expect(eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.tipo_de_ato_sem_versao_vigente')).toBe(true);
  });

  it('não reconhece código de conformidade estrutural nem legal', () => {
    expect(eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.conformidade_insuficiente')).toBe(
      false,
    );
    expect(eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.conformidade_legal_insuficiente')).toBe(false);
  });
});

describe('comExtensoesDePublicacao', () => {
  it('expõe pendencias e obrigatoriedadesReprovadas quando presentes no body', () => {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'x',
      status: 422,
      code: 'uniplus.selecao.processo_seletivo.conformidade_insuficiente',
      traceId: 't',
    };
    const comExtensoes = {
      ...problem,
      pendencias: [{ codigo: 'a', dimensao: 'taxa_inscricao', mensagem: 'x' }],
    };

    const resultado = comExtensoesDePublicacao(comExtensoes);
    expect(resultado.pendencias).toEqual(comExtensoes.pendencias);
    expect(resultado.obrigatoriedadesReprovadas).toBeUndefined();
  });
});
