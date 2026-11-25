import { TipoDoDadoCodigo } from '@uniplus/shared-data/configuracao';
import { aceitoNoDerivado, tiposDoDadoDoDerivado } from './fato-candidato.regras';
import { describe, expect, it } from 'vitest';
import {
  fatoDeMembroDoBinding,
  acaoDeAtivacao,
  classificacoesDoDominio,
  corpoDaDefinicao,
  podeEditarDefinicao,
  fatosDeMembroAgregaveis,
  fatosCitaveisPelaRegra,
  indiceDaRegra,
  podeTerRegras,
  podeTerValores,
  resumoDoAgregado,
} from './fato-candidato.regras';
import { citacoesDaRecusa } from './citacoes-do-fato';
import {
  fonteCatalogo,
  fonteDoProcesso,
  origemCalculada,
  origemDeclarada,
  tipoNumerico,
  tipoOpcao,
  tipoSimOuNao,
} from './fatos-candidato.fixtures';

const vinculo = (binding: string) => ({ definicao: { resolucao: { binding } } });

const fato = (
  binding: string,
  extra: Partial<{
    semeadoPeloSistema: boolean;
    dominio: typeof tipoOpcao | typeof tipoNumerico;
    fonteValores: typeof fonteCatalogo | typeof fonteDoProcesso | null;
  }> = {},
) => {
  const { semeadoPeloSistema = false, dominio = tipoOpcao, fonteValores = fonteCatalogo } = extra;
  return {
    semeadoPeloSistema,
    definicao: {
      dominio,
      valores: { fonte: fonteValores },
      resolucao: { binding },
    },
  };
};

describe('o que cada fato deixa manter', () => {
  it('valores: declarado e derivado por regra categóricos de fonte global do administrador', () => {
    expect(podeTerValores(fato('CAMPO_INSCRICAO:COR'))).toBe(true);
    expect(podeTerValores(fato('REGRA_DERIVACAO:PERFIL'))).toBe(true);
    expect(
      podeTerValores(fato('AGREGACAO_GRUPO:RENDA')),
      'o agregado herda os valores do membro',
    ).toBe(false);
    expect(
      podeTerValores(fato('CAMPO_INSCRICAO:COR', { semeadoPeloSistema: true })),
      'o de sistema só muda por versão',
    ).toBe(false);
    expect(podeTerValores(fato('CAMPO_INSCRICAO:OPCAO', { fonteValores: fonteDoProcesso }))).toBe(
      false,
    );
    expect(
      podeTerValores(fato('CAMPO_INSCRICAO:IDADE', { dominio: tipoNumerico, fonteValores: null })),
    ).toBe(false);
  });

  it('regras padrão: só o derivado por regra do administrador', () => {
    expect(podeTerRegras(fato('REGRA_DERIVACAO:PERFIL'))).toBe(true);
    expect(
      podeTerRegras(fato('AGREGACAO_GRUPO:RENDA')),
      'o agregado também é derivado, mas não tem regra',
    ).toBe(false);
    expect(podeTerRegras(fato('REGRA_DERIVACAO:MODALIDADE', { semeadoPeloSistema: true }))).toBe(
      false,
    );
  });
});

describe('o que a API recusa e a tela não oferece', () => {
  it('texto, data e endereço são no mínimo dado pessoal; só o texto pode ser identificador', () => {
    const valores = (dominio: string) => classificacoesDoDominio(dominio).map((c) => c.valor);
    expect(valores('TEXTO')).toEqual(['PESSOAL', 'IDENTIFICADOR', 'SENSIVEL']);
    expect(valores('DATA')).toEqual(['PESSOAL', 'SENSIVEL']);
    expect(valores('SIM_OU_NAO')).toEqual(['PUBLICO', 'INTERNO', 'PESSOAL', 'SENSIVEL']);
  });

  it('a regra padrão não cita fato desativado, fato de membro nem o próprio derivado', () => {
    const catalogo = [
      { codigo: 'COR', ativo: true, escopo: 'CANDIDATO' },
      { codigo: 'ANTIGO', ativo: false, escopo: 'CANDIDATO' },
      { codigo: 'PARENTESCO', ativo: true, escopo: 'MEMBRO_GRUPO' },
      { codigo: 'PERFIL', ativo: true, escopo: 'CANDIDATO' },
    ];
    expect(fatosCitaveisPelaRegra(catalogo, 'PERFIL').map((f) => f.codigo)).toEqual(['COR']);
  });

  it('a recusa de uma regra aponta o índice dela', () => {
    expect(indiceDaRegra('regras[2].quando[0][1]')).toBe(2);
    expect(indiceDaRegra('regras[0]')).toBe(0);
    expect(indiceDaRegra('nome')).toBeNull();
  });
});

describe('agregado de grupo', () => {
  it('resume só fato declarado ativo de membro de grupo, sim ou não ou com opções', () => {
    const membro = {
      ativo: true,
      escopo: 'MEMBRO_GRUPO',
      origem: origemDeclarada,
      dominio: tipoSimOuNao,
    };
    const catalogo = [
      { ...membro, codigo: 'TRABALHA' },
      { ...membro, codigo: 'PARENTESCO', dominio: tipoOpcao },
      { ...membro, codigo: 'RENDA', dominio: tipoNumerico },
      { ...membro, codigo: 'ANTIGO', ativo: false },
      { ...membro, codigo: 'QUILOMBOLA', escopo: 'CANDIDATO' },
      { ...membro, codigo: 'IDOSO', origem: origemCalculada },
    ];
    expect(fatosDeMembroAgregaveis(catalogo).map((f) => f.codigo)).toEqual([
      'TRABALHA',
      'PARENTESCO',
    ]);
  });

  it('o membro sim ou não dá "existe membro que…"; o com opções, os valores presentes', () => {
    expect(resumoDoAgregado('SIM_OU_NAO')).toContain('ao menos um membro');
    expect(resumoDoAgregado('OPCAO')).toContain('valores que aparecem');
  });
});

describe('ativação do fato', () => {
  it('o fato de sistema não se desativa nem se reativa; o do administrador alterna', () => {
    expect(acaoDeAtivacao({ semeadoPeloSistema: true, ativo: true })).toBeNull();
    expect(acaoDeAtivacao({ semeadoPeloSistema: false, ativo: true })).toBe('DESATIVAR');
    expect(acaoDeAtivacao({ semeadoPeloSistema: false, ativo: false })).toBe('REATIVAR');
  });
});

describe('a definição que o administrador altera', () => {
  const v = {
    dominio: 'TEXTO',
    cardinalidade: 'VALOR_UNICO',
    fonteValores: 'CATALOGO',
    formato: 'CPF',
    escopo: 'CANDIDATO',
    pontoResolucao: 'INSCRICAO',
    classificacaoProtecao: 'IDENTIFICADOR',
    finalidadeTratamento: ' Identificar. ',
    hipoteseLegal: 'CONSENTIMENTO',
  };

  it('declarado de texto leva o formato e a fonte nula; o de lista leva a fonte e o formato nulo', () => {
    expect(corpoDaDefinicao('DECLARADO', v)).toMatchObject({
      formato: 'CPF',
      fonteValores: null,
      cardinalidade: 'VALOR_UNICO',
      finalidadeTratamento: 'Identificar.',
    });
    expect(corpoDaDefinicao('DECLARADO', { ...v, dominio: 'OPCAO' })).toMatchObject({
      formato: null,
      fonteValores: 'CATALOGO',
    });
  });

  it('derivado e agregado não levam os eixos que o tipo não aceita', () => {
    expect(Object.keys(corpoDaDefinicao('DERIVADO_POR_REGRA', v))).not.toEqual(
      expect.arrayContaining(['cardinalidade']),
    );
    expect(corpoDaDefinicao('DERIVADO_POR_REGRA', v)).not.toHaveProperty('fonteValores');
    expect(Object.keys(corpoDaDefinicao('AGREGADO', v)).sort()).toEqual([
      'classificacaoProtecao',
      'finalidadeTratamento',
      'hipoteseLegal',
      'pontoResolucao',
    ]);
  });

  it('o fato de sistema e o de vínculo desconhecido não se editam', () => {
    expect(podeEditarDefinicao({ ...vinculo('CAMPO_INSCRICAO:X'), semeadoPeloSistema: true })).toBe(
      false,
    );
    expect(podeEditarDefinicao({ ...vinculo('SISTEMA:X'), semeadoPeloSistema: false })).toBe(false);
    expect(
      podeEditarDefinicao({ ...vinculo('REGRA_DERIVACAO:X'), semeadoPeloSistema: false }),
    ).toBe(true);
  });

  it('agrupa as citações por tipo e deixa de fora a recusa de campo', () => {
    const grupos = citacoesDaRecusa([
      { field: 'citacoes.modelos.A.B', message: 'm1' },
      { field: 'citacoes.regrasPadrao.P', message: 'm2' },
      { field: 'citacoes.modelos.C', message: 'm3' },
      { field: 'dominio', message: 'campo' },
    ]);
    expect(grupos.map((g) => [g.tipo, g.itens.map((i) => i.codigo)])).toEqual([
      ['regrasPadrao', ['P']],
      ['modelos', ['A.B', 'C']],
    ]);
  });
});

describe('o fato de membro do agregado', () => {
  it('sai do binding do agregado e é nulo nos outros tipos', () => {
    expect(fatoDeMembroDoBinding(vinculo('AGREGACAO_GRUPO:RENDA'))).toBe('RENDA');
    expect(fatoDeMembroDoBinding(vinculo('REGRA_DERIVACAO:RENDA'))).toBeNull();
  });
});

describe('tipos de dado do derivado', () => {
  it('aceita apenas sim ou não e opção', () => {
    expect(aceitoNoDerivado('SIM_OU_NAO')).toBe(true);
    expect(aceitoNoDerivado('OPCAO')).toBe(true);
    expect(aceitoNoDerivado('TEXTO')).toBe(false);
  });

  it('preserva a ordem e os rótulos recebidos', () => {
    const itens = [
      { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Segundo a API' },
      { codigo: TipoDoDadoCodigo.TEXTO, rotulo: 'Texto da API' },
      { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Primeiro da API' },
    ];
    expect(tiposDoDadoDoDerivado(itens)).toEqual([itens[0], itens[2]]);
  });
});
