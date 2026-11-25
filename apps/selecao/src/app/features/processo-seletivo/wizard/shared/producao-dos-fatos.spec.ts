import {
  apresentacaoDoCampo,
  conteudoInicial,
  REGRAS_INICIAIS,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';

import type { FormularioDeInscricao } from '../processo-seletivo.models';
import {
  oProcessoResolve,
  producaoDoRascunho,
  recusaDaRepeticao,
  recusaDeFaseDoGatilho,
} from './producao-dos-fatos';
import {
  ALGUM_SEM_RENDA,
  COM_HABILITACAO,
  CONVOCACAO,
  DO_SIGAA,
  FAIXA_ETARIA,
  FASE_DIVIDIDA,
  FASES,
  formulario,
  LAUDO_RECENTE,
  na,
  PCD,
  PERFIL,
  producao,
  SEM_RENDA,
} from './producao-dos-fatos.testing';

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
    expect(
      recusaDeFaseDoGatilho('MODALIDADE_CONVOCACAO', na('HABILITACAO'), producao()),
    ).toBeNull();
  });

  it('o fato situado numa fase que o cronograma não tem não vale em fase nenhuma', () => {
    const semResultado = producao({
      fases: FASES.filter((fase) => fase.codigo !== 'RESULTADO_FINAL'),
    });

    expect(recusaDeFaseDoGatilho('MODALIDADE_CONVOCACAO', na('HABILITACAO'), semResultado)).toEqual(
      {
        tipo: 'FASE_FORA_DO_CRONOGRAMA',
        fato: 'MODALIDADE_CONVOCACAO',
        origem: 'MODALIDADE_CONVOCACAO',
        faseCodigo: 'RESULTADO_FINAL',
      },
    );
  });

  it('o derivado por regra fica conhecido só quando o que ele cita é', () => {
    const derivado = producao({
      ...COM_HABILITACAO,
      derivacoes: new Map([['PERFIL', ['PCD', 'LAUDO_RECENTE']]]),
    });

    expect(recusaDeFaseDoGatilho('PERFIL', na('INSCRICAO'), derivado)).toEqual({
      tipo: 'FASE_POSTERIOR',
      fato: 'PERFIL',
      faseCodigo: 'HABILITACAO',
    });
  });

  it('o agregado fica conhecido só quando o fato de membro é', () => {
    const agregado = producao({
      formularios: [
        formulario('INSCRICAO', 'INSCRICAO', 'PCD'),
        formulario('HABILITACAO', 'HABILITACAO', 'SEM_RENDA'),
      ],
    });

    expect(recusaDeFaseDoGatilho('ALGUM_SEM_RENDA', na('INSCRICAO'), agregado)?.tipo).toBe(
      'FASE_POSTERIOR',
    );
    expect(recusaDeFaseDoGatilho('ALGUM_SEM_RENDA', na('HABILITACAO'), agregado)).toBeNull();
  });

  it('o fato só da isenção vale apenas no documento do formulário de isenção, mesmo na fase que a inscrição divide com ela', () => {
    expect(
      recusaDeFaseDoGatilho('BAIXA_RENDA', na('INSCRICAO', 'ISENCAO_TAXA'), FASE_DIVIDIDA),
    ).toBeNull();
    expect(
      recusaDeFaseDoGatilho('BAIXA_RENDA', na('INSCRICAO', 'INSCRICAO'), FASE_DIVIDIDA),
    ).toEqual({
      tipo: 'SO_DA_ISENCAO',
      fato: 'BAIXA_RENDA',
      faseCodigo: 'INSCRICAO',
    });
  });

  it('na fase dividida, o documento sem formulário fica com a recusa da escolha dele, e não com a do gatilho', () => {
    expect(recusaDeFaseDoGatilho('BAIXA_RENDA', na('INSCRICAO'), FASE_DIVIDIDA)).toBeNull();
  });

  it('o coletável que nenhum formulário coleta conta como da inscrição, que passa a coletá-lo', () => {
    const inscricaoDepois = producao({
      formularios: [formulario('INSCRICAO', 'SOLICITACAO_ISENCAO', 'PCD')],
    });

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
    expect(oProcessoResolve(PERFIL, producao({ derivacoes: new Map([['PERFIL', ['PCD']]]) }))).toBe(
      true,
    );
  });

  it('o agregado só quando algum formulário coleta o fato de membro', () => {
    expect(oProcessoResolve(ALGUM_SEM_RENDA, producao())).toBe(false);
    expect(
      oProcessoResolve(
        ALGUM_SEM_RENDA,
        producao({ formularios: [formulario('HABILITACAO', 'HABILITACAO', 'SEM_RENDA')] }),
      ),
    ).toBe(true);
  });

  it('o de integração nunca; o calculado do candidato e o da classificação, sempre', () => {
    expect(oProcessoResolve(DO_SIGAA, producao())).toBe(false);
    expect(oProcessoResolve(FAIXA_ETARIA, producao())).toBe(true);
    expect(oProcessoResolve(CONVOCACAO, producao())).toBe(true);
  });
});

describe('a produção dos fatos no rascunho', () => {
  const item = (fatoCodigo: string): ItemDoFormulario => ({
    fatoCodigo,
    ordem: 0,
    paginaCodigo: null,
    apresentacao: apresentacaoDoCampo(fatoCodigo, 'SIM_OU_NAO'),
    regras: REGRAS_INICIAIS,
  });

  it('lê a fase de cada formulário e os fatos que a regra de derivação cita', () => {
    const rascunho: FormularioDeInscricao = {
      faseCodigo: 'INSCRICAO',
      conteudo: conteudoInicial(),
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      derivacao: [
        {
          codigoFato: 'PERFIL',
          regras: [{ quando: [[{ fato: 'LAUDO_RECENTE', operador: 'IGUAL', valor: true }]] }],
        },
      ],
      outrasFinalidades: [
        {
          finalidade: 'HABILITACAO',
          faseCodigo: 'HABILITACAO',
          conteudo: { ...conteudoInicial(), itens: [item('LAUDO_RECENTE')] },
        },
      ],
    };

    const lida = producaoDoRascunho(rascunho, FASES, [PCD, LAUDO_RECENTE, PERFIL]);

    expect(recusaDeFaseDoGatilho('PERFIL', na('INSCRICAO'), lida)?.faseCodigo).toBe('HABILITACAO');
    expect(recusaDeFaseDoGatilho('PERFIL', na('HABILITACAO'), lida)).toBeNull();
  });

  it('lê os grupos repetíveis de cada formulário, com os campos que eles coletam', () => {
    const familia = {
      codigo: 'FAMILIA',
      ordem: 0,
      rotulo: 'Composição familiar',
      paginaCodigo: null,
      ocorrencias: { minimo: 1, maximo: null, incluiCandidato: true },
      regras: REGRAS_INICIAIS,
      subitens: [item('SEM_RENDA')],
    };
    const rascunho: FormularioDeInscricao = {
      faseCodigo: 'INSCRICAO',
      conteudo: conteudoInicial(),
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      derivacao: [],
      outrasFinalidades: [
        {
          finalidade: 'HABILITACAO',
          faseCodigo: 'HABILITACAO',
          conteudo: { ...conteudoInicial(), grupos: [familia] },
        },
      ],
    };

    const lida = producaoDoRascunho(rascunho, FASES, [PCD, SEM_RENDA]);

    expect(lida.grupos.get('FAMILIA')).toEqual({
      codigo: 'FAMILIA',
      rotulo: 'Composição familiar',
      campos: ['SEM_RENDA'],
    });
    expect(recusaDaRepeticao('FAMILIA', na('INSCRICAO'), lida)?.tipo).toBe('GRUPO_FORA_DO_LUGAR');
  });
});
