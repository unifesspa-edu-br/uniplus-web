import { conteudoInicial, type ItemDoFormulario } from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';

import type { FormularioDeInscricao } from '../processo-seletivo.models';
import {
  oProcessoResolve,
  orientacaoDaRecusaDeFase,
  producaoDoRascunho,
  recusaDeFaseDoGatilho,
  recusaDaExigenciaDoServidor,
  type FatoComFase,
  type FormularioQueColeta,
  type LugarDaExigencia,
  type ProducaoDosFatos,
} from './fase-do-fato';

const fato = (codigo: string, extra: Partial<FatoComFase> = {}): FatoComFase => ({
  codigo,
  nome: codigo,
  dominio: 'BOOLEANO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  fonteValores: null,
  binding: `CAMPO_FORMULARIO:${codigo}`,
  escopo: 'CANDIDATO',
  ativo: true,
  pontoResolucao: 'INSCRICAO',
  ...extra,
});

const PCD = fato('PCD');
const LAUDO_RECENTE = fato('LAUDO_RECENTE');
const BAIXA_RENDA = fato('BAIXA_RENDA');
const SEM_RENDA = fato('SEM_RENDA', { escopo: 'MEMBRO_GRUPO' });
const ALGUM_SEM_RENDA = fato('ALGUM_SEM_RENDA', { binding: 'AGREGACAO_GRUPO:SEM_RENDA' });
const PERFIL = fato('PERFIL', { binding: 'REGRA_DERIVACAO:PERFIL' });
const CONVOCACAO = fato('MODALIDADE_CONVOCACAO', {
  dominio: 'CATEGORICO',
  fonteValores: 'MODALIDADE',
  binding: 'CLASSIFICACAO:MODALIDADE_CONVOCACAO',
  pontoResolucao: 'RESULTADO_FINAL',
});
const DO_SIGAA = fato('DO_SIGAA', { binding: 'INTEGRACAO:SIGAA' });
const FAIXA_ETARIA = fato('FAIXA_ETARIA', { dominio: 'NUMERICO', binding: 'ATRIBUTO_CANDIDATO:FAIXA_ETARIA' });

const FASES = [
  { codigo: 'INSCRICAO', ordem: 1, finalidades: ['INSCRICAO'] },
  { codigo: 'SOLICITACAO_ISENCAO', ordem: 2, finalidades: ['ISENCAO_TAXA'] },
  { codigo: 'RESULTADO_FINAL', ordem: 3, finalidades: [] },
  { codigo: 'HABILITACAO', ordem: 4, finalidades: ['HABILITACAO'] },
];

/** A exigência cobrada na fase, no formulário declarado; sem declaração, no único que a fase responde. */
const na = (faseCodigo: string, finalidade: string | null = null): LugarDaExigencia => ({ faseCodigo, finalidade });

const formulario = (finalidade: string, faseCodigo: string, ...fatos: string[]): FormularioQueColeta => ({
  finalidade,
  faseCodigo,
  fatos: new Set(fatos),
});

function producao(parcial: Partial<ProducaoDosFatos> = {}): ProducaoDosFatos {
  return {
    fases: FASES,
    formularios: [formulario('INSCRICAO', 'INSCRICAO', 'PCD')],
    derivacoes: new Map(),
    catalogo: new Map(
      [PCD, LAUDO_RECENTE, BAIXA_RENDA, SEM_RENDA, ALGUM_SEM_RENDA, PERFIL, CONVOCACAO, DO_SIGAA, FAIXA_ETARIA].map((f) => [
        f.codigo,
        f,
      ]),
    ),
    ...parcial,
  };
}

const NOMES = {
  fato: (codigo: string) => codigo.toLocaleLowerCase('pt-BR'),
  fase: (codigo: string) => codigo.toLocaleLowerCase('pt-BR'),
};

/** Inscrição e isenção na mesma fase, com o fato que só o formulário de isenção coleta. */
const FASE_DIVIDIDA = producao({
  fases: [
    { codigo: 'INSCRICAO', ordem: 1, finalidades: ['INSCRICAO', 'ISENCAO_TAXA'] },
    { codigo: 'RESULTADO_FINAL', ordem: 2, finalidades: [] },
  ],
  formularios: [formulario('INSCRICAO', 'INSCRICAO', 'PCD'), formulario('ISENCAO_TAXA', 'INSCRICAO', 'BAIXA_RENDA')],
});

const COM_HABILITACAO = producao({
  formularios: [formulario('INSCRICAO', 'INSCRICAO', 'PCD'), formulario('HABILITACAO', 'HABILITACAO', 'LAUDO_RECENTE')],
});

describe('a fase em que o gatilho pode citar o fato', () => {
  it('o fato coletado pela habilitação só vale na fase dela ou depois', () => {
    expect(recusaDeFaseDoGatilho('LAUDO_RECENTE', na('INSCRICAO'), COM_HABILITACAO)).toEqual({
      tipo: 'FASE_POSTERIOR',
      fato: 'LAUDO_RECENTE',
      faseCodigo: 'HABILITACAO',
    });
    expect(recusaDeFaseDoGatilho('LAUDO_RECENTE', na('HABILITACAO'), COM_HABILITACAO)).toBeNull();
  });

  it('a modalidade da convocação só vale a partir do resultado final, onde o catálogo a situa', () => {
    expect(recusaDeFaseDoGatilho('MODALIDADE_CONVOCACAO', na('INSCRICAO'), producao())).toEqual({
      tipo: 'FASE_POSTERIOR',
      fato: 'MODALIDADE_CONVOCACAO',
      faseCodigo: 'RESULTADO_FINAL',
    });
    expect(recusaDeFaseDoGatilho('MODALIDADE_CONVOCACAO', na('HABILITACAO'), producao())).toBeNull();
  });

  it('o fato situado numa fase que o cronograma não tem não vale em fase nenhuma', () => {
    const semResultado = producao({ fases: FASES.filter((fase) => fase.codigo !== 'RESULTADO_FINAL') });

    expect(recusaDeFaseDoGatilho('MODALIDADE_CONVOCACAO', na('HABILITACAO'), semResultado)).toEqual({
      tipo: 'FASE_FORA_DO_CRONOGRAMA',
      fato: 'MODALIDADE_CONVOCACAO',
      origem: 'MODALIDADE_CONVOCACAO',
      faseCodigo: 'RESULTADO_FINAL',
    });
  });

  it('o derivado por regra fica conhecido só quando o que ele cita é', () => {
    const derivado = producao({ ...COM_HABILITACAO, derivacoes: new Map([['PERFIL', ['PCD', 'LAUDO_RECENTE']]]) });

    expect(recusaDeFaseDoGatilho('PERFIL', na('INSCRICAO'), derivado)).toEqual({
      tipo: 'FASE_POSTERIOR',
      fato: 'PERFIL',
      faseCodigo: 'HABILITACAO',
    });
  });

  it('o agregado fica conhecido só quando o fato de membro é', () => {
    const agregado = producao({
      formularios: [formulario('INSCRICAO', 'INSCRICAO', 'PCD'), formulario('HABILITACAO', 'HABILITACAO', 'SEM_RENDA')],
    });

    expect(recusaDeFaseDoGatilho('ALGUM_SEM_RENDA', na('INSCRICAO'), agregado)?.tipo).toBe('FASE_POSTERIOR');
    expect(recusaDeFaseDoGatilho('ALGUM_SEM_RENDA', na('HABILITACAO'), agregado)).toBeNull();
  });

  it('o fato só da isenção vale apenas no documento do formulário de isenção, mesmo na fase que a inscrição divide com ela', () => {
    expect(recusaDeFaseDoGatilho('BAIXA_RENDA', na('INSCRICAO', 'ISENCAO_TAXA'), FASE_DIVIDIDA)).toBeNull();
    expect(recusaDeFaseDoGatilho('BAIXA_RENDA', na('INSCRICAO', 'INSCRICAO'), FASE_DIVIDIDA)).toEqual({
      tipo: 'SO_DA_ISENCAO',
      fato: 'BAIXA_RENDA',
      faseCodigo: 'INSCRICAO',
    });
  });

  it('na fase dividida, o documento sem formulário fica com a recusa da escolha dele, e não com a do gatilho', () => {
    expect(recusaDeFaseDoGatilho('BAIXA_RENDA', na('INSCRICAO'), FASE_DIVIDIDA)).toBeNull();
  });

  it('o coletável que nenhum formulário coleta conta como da inscrição, que passa a coletá-lo', () => {
    const inscricaoDepois = producao({ formularios: [formulario('INSCRICAO', 'SOLICITACAO_ISENCAO', 'PCD')] });

    expect(recusaDeFaseDoGatilho('LAUDO_RECENTE', na('INSCRICAO'), inscricaoDepois)).toEqual({
      tipo: 'FASE_POSTERIOR',
      fato: 'LAUDO_RECENTE',
      faseCodigo: 'SOLICITACAO_ISENCAO',
    });
  });

  it('a exigência de fase fora do cronograma fica com a conferência dela', () => {
    expect(recusaDeFaseDoGatilho('LAUDO_RECENTE', na('MATRICULA'), COM_HABILITACAO)).toBeNull();
  });
});

describe('os fatos que o processo resolve', () => {
  it('o derivado por regra só quando o processo declara a regra dele', () => {
    expect(oProcessoResolve(PERFIL, producao())).toBe(false);
    expect(oProcessoResolve(PERFIL, producao({ derivacoes: new Map([['PERFIL', ['PCD']]]) }))).toBe(true);
  });

  it('o agregado só quando algum formulário coleta o fato de membro', () => {
    expect(oProcessoResolve(ALGUM_SEM_RENDA, producao())).toBe(false);
    expect(
      oProcessoResolve(ALGUM_SEM_RENDA, producao({ formularios: [formulario('HABILITACAO', 'HABILITACAO', 'SEM_RENDA')] })),
    ).toBe(true);
  });

  it('o de integração nunca; o calculado do candidato e o da classificação, sempre', () => {
    expect(oProcessoResolve(DO_SIGAA, producao())).toBe(false);
    expect(oProcessoResolve(FAIXA_ETARIA, producao())).toBe(true);
    expect(oProcessoResolve(CONVOCACAO, producao())).toBe(true);
  });
});

describe('a orientação da recusa de fase', () => {
  const orientar = (codigo: string, lugar: LugarDaExigencia, contexto: ProducaoDosFatos): string => {
    const recusa = recusaDeFaseDoGatilho(codigo, lugar, contexto);
    if (recusa === null) throw new Error('esperava recusa');
    return orientacaoDaRecusaDeFase(recusa, lugar, contexto, NOMES);
  };

  it('propõe levar a exigência para a fase do fato ou levar o campo para a inscrição', () => {
    expect(orientar('LAUDO_RECENTE', na('INSCRICAO'), COM_HABILITACAO)).toBe(
      '“laudo_recente” só é conhecido na fase habilitacao, depois da fase em que o documento é exigido. ' +
        'Como resolver: exija o documento na fase habilitacao; ou colete “laudo_recente” no formulário de inscrição.',
    );
  });

  it('não propõe mudar de formulário o fato que o catálogo situa depois da exigência', () => {
    expect(orientar('MODALIDADE_CONVOCACAO', na('INSCRICAO'), producao())).toBe(
      '“modalidade_convocacao” só é conhecido na fase resultado_final, depois da fase em que o documento é exigido. ' +
        'Como resolver: exija o documento na fase resultado_final ou em fase posterior.',
    );
  });

  it('do fato só da isenção, propõe a fase da isenção e a coleta pela inscrição quando ela vem antes', () => {
    const comIsencao = producao({
      formularios: [formulario('INSCRICAO', 'INSCRICAO', 'PCD'), formulario('ISENCAO_TAXA', 'SOLICITACAO_ISENCAO', 'BAIXA_RENDA')],
    });

    expect(orientar('BAIXA_RENDA', na('HABILITACAO'), comIsencao)).toBe(
      '“baixa_renda” vem do formulário de isenção e só condiciona documento apresentado nele, que se responde na fase solicitacao_isencao. ' +
        'Como resolver: exija o documento na fase solicitacao_isencao; ou colete “baixa_renda” no formulário de inscrição.',
    );
  });

  it('na fase dividida, propõe o formulário de isenção da mesma fase, e não a fase inteira', () => {
    expect(orientar('BAIXA_RENDA', na('INSCRICAO', 'INSCRICAO'), FASE_DIVIDIDA)).toBe(
      '“baixa_renda” vem do formulário de isenção e só condiciona documento apresentado nele, que se responde na fase inscricao. ' +
        'Como resolver: exija o documento no formulário de isenção da taxa de inscrição, na fase inscricao; ou colete “baixa_renda” no formulário de inscrição.',
    );
  });

  it('não propõe levar o campo para formulário em que ele também seria recusado', () => {
    const tresFormularios = producao({
      formularios: [
        formulario('INSCRICAO', 'INSCRICAO', 'PCD'),
        formulario('ISENCAO_TAXA', 'SOLICITACAO_ISENCAO'),
        formulario('HABILITACAO', 'HABILITACAO', 'LAUDO_RECENTE'),
      ],
    });

    const orientacao = orientar('LAUDO_RECENTE', na('RESULTADO_FINAL'), tresFormularios);

    expect(orientacao).toContain('colete “laudo_recente” no formulário de inscrição');
    expect(orientacao).not.toContain('formulário de isenção da taxa de inscrição');
  });

  it('sem fase que o aceite, propõe acrescentar ao cronograma a fase em que o fato é conhecido', () => {
    const semResultado = producao({ fases: FASES.filter((fase) => fase.codigo !== 'RESULTADO_FINAL') });

    expect(orientar('MODALIDADE_CONVOCACAO', na('HABILITACAO'), semResultado)).toBe(
      '“modalidade_convocacao” só é conhecido na fase resultado_final, que o cronograma não tem. ' +
        'Como resolver: acrescente ao cronograma a fase resultado_final e exija o documento nela ou em fase posterior.',
    );
  });
});

describe('a produção dos fatos no rascunho', () => {
  const item = (fatoCodigo: string): ItemDoFormulario => ({
    fatoCodigo,
    ordem: 0,
    rotulo: fatoCodigo,
    tipoRenderizacao: 'BOOLEANO',
    obrigatoriedade: 'SEMPRE',
    precondicao: null,
    etapaCodigo: null,
    predicadoObrigatoriedade: null,
    ajuda: null,
    pedirConfirmacao: false,
  });

  it('lê a fase de cada formulário e os fatos que a regra de derivação cita', () => {
    const rascunho: FormularioDeInscricao = {
      faseCodigo: 'INSCRICAO',
      conteudo: conteudoInicial(),
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      derivacao: [{ codigoFato: 'PERFIL', regras: [{ quando: [[{ fato: 'LAUDO_RECENTE', operador: 'IGUAL', valor: true }]] }] }],
      outrasFinalidades: [
        { finalidade: 'HABILITACAO', faseCodigo: 'HABILITACAO', conteudo: { ...conteudoInicial(), itens: [item('LAUDO_RECENTE')] } },
      ],
    };

    const lida = producaoDoRascunho(rascunho, FASES, [PCD, LAUDO_RECENTE, PERFIL]);

    expect(recusaDeFaseDoGatilho('PERFIL', na('INSCRICAO'), lida)?.faseCodigo).toBe('HABILITACAO');
    expect(recusaDeFaseDoGatilho('PERFIL', na('HABILITACAO'), lida)).toBeNull();
  });
});

describe('a recusa do servidor sobre onde o documento é cobrado', () => {
  const recusa = (code: string, errors: readonly { field: string; code: string; message: string }[] = []) =>
    recusaDaExigenciaDoServidor({ code, errors });

  it('diz o que fazer para cada recusa de fase, e nada para as outras', () => {
    expect(recusa('uniplus.selecao.documento_exigido.fato_resolvido_em_fase_posterior')).toContain(
      'Exija o documento numa fase em que o dado já seja conhecido',
    );
    expect(recusa('uniplus.selecao.documento_exigido.fato_da_isencao_em_outra_finalidade')).toContain(
      'Escolha o formulário de isenção no campo “Formulário” do documento',
    );
    expect(recusa('uniplus.selecao.documento_exigido.ponto_resolucao_fora_do_cronograma')).toContain(
      'Acrescente essa fase ao cronograma',
    );
    expect(recusa('uniplus.selecao.documento_exigido.outra')).toBeNull();
  });

  it('as recusas do formulário do documento apontam o campo “Formulário”, venham no problema ou num erro dele', () => {
    const CAMPO = 'no campo “Formulário” do documento';
    expect(recusa('uniplus.selecao.documento_exigido.finalidade_obrigatoria')).toContain(CAMPO);
    expect(recusa('uniplus.selecao.documento_exigido.fase_incoerente_com_finalidade')).toContain(CAMPO);
    expect(recusa('uniplus.selecao.no_exigencia.grupo_com_finalidades_diferentes')).toContain(CAMPO);
    expect(
      recusa('uniplus.validacao', [{ field: 'raizes[0].documento.finalidade', code: 'uniplus.estrutura_formulario.finalidade_invalida', message: '' }]),
    ).toContain(CAMPO);
  });
});
