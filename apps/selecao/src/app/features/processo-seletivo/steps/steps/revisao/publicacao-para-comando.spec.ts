import { ProblemDetails } from '@uniplus/shared-core/http';
import { ItemConformidadeDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { FaseDoCronograma, WizardDraft } from '../../processo-seletivo.models';
import {
  agruparPorDimensao,
  comExtensoesDePublicacao,
  comoComandoDePublicacao,
  dataReferenciaLegalDe,
  eErroDeDocumentoOuAto,
  faseQueAncoraOPeriodoDeInscricao,
  mensagensDePublicacao,
  passoDaDimensao,
  rotuloDaDimensao,
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
      municipioConvenio: '',
      baseLegal: '',
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

describe('passoDaDimensao', () => {
  it('conhece as seis dimensões com passo implementado', () => {
    expect(passoDaDimensao('taxa_inscricao')).toBe(2);
    expect(passoDaDimensao('distribuicao_vagas')).toBe(3);
    expect(passoDaDimensao('cascata_remanejamento')).toBe(3);
    expect(passoDaDimensao('cronograma')).toBe(4);
    expect(passoDaDimensao('contagem_de_prazos')).toBe(4);
    expect(passoDaDimensao('classificacao')).toBe(9);
    expect(passoDaDimensao('atendimento_especializado')).toBe(10);
  });

  it('não inventa passo para dimensão fora do núcleo desta frente', () => {
    expect(passoDaDimensao('exigencias_documentais')).toBeNull();
    expect(passoDaDimensao('coleta_de_fatos')).toBeNull();
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
