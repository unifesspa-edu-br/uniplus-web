import { OperadorCodigo, TipoRenderizacaoCodigo } from '@uniplus/shared-data/configuracao';
import { type ConteudoDoFormulario, type ItemDoFormulario } from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';
import { conteudoDoModelo, conteudoParaOModelo } from './conteudo-do-modelo';
import { modelo } from './modelo-formulario-edicao.page.testing';

const QUANDO = [[{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true }]];

const item: ItemDoFormulario<number> = {
  fatoCodigo: 'ESCOLA_PUBLICA',
  ordem: 1,
  apresentacao: {
    rotulo: 'Estudou em escola pública?',
    tipoRenderizacao: 'BOOLEANO',
    pedirConfirmacao: false,
  },
  regras: {
    exibicao: QUANDO,
    obrigatoriedade: { tipo: 'QUANDO', predicado: QUANDO },
    restricoes: [{ tipo: 'SUBCONJUNTO', entradas: [{ quando: QUANDO, valores: ['true'] }] }],
    impedimento: { quando: QUANDO, mensagem: 'Só para egressos.' },
  },
};

const conteudo: ConteudoDoFormulario<number> = {
  titulo: 'Inscrição',
  etapas: [
    {
      codigo: 'SECAO_1',
      ordem: 1,
      tipo: 'SECAO',
      bloco: null,
      apresentacao: { titulo: 'Dados', descricao: null, aviso: null },
      exibicao: QUANDO,
    },
  ],
  itens: [item],
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 2,
      rotulo: 'Composição familiar',
      etapaCodigo: null,
      ocorrencias: { minimo: 1, maximo: null, incluiCandidato: true },
      regras: { exibicao: QUANDO, obrigatoriedade: { tipo: 'QUANDO', predicado: QUANDO } },
      subitens: [item],
    },
  ],
  termos: [
    {
      codigo: 'LGPD',
      ordem: 3,
      termo: { termoId: 'T1', versaoId: 'V1' },
      regras: { exibicao: QUANDO, obrigatoriedade: { tipo: 'QUANDO', predicado: QUANDO } },
    },
  ],
  pressupostos: [],
  documentosExigidos: [
    {
      faseCodigo: 'INSCRICAO',
      tipoDocumentoCodigo: 'LAUDO_MEDICO',
      obrigatorio: true,
      quando: QUANDO,
      consequenciaIndeferimento: 'ELIMINA',
      basesLegais: null,
    },
  ],
};

const semPredicado = { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } };

const comCodigosDesconhecidos: ConteudoDoFormulario<number> = {
  ...conteudo,
  itens: [
    {
      ...item,
      apresentacao: { ...item.apresentacao, tipoRenderizacao: 'INVENTADO' },
      regras: { ...item.regras, exibicao: [[{ ...QUANDO[0][0], operador: 'PARECIDO' }]] },
    },
  ],
};

const operadorDe = (predicado: readonly (readonly { operador: unknown }[])[] | null | undefined) =>
  predicado?.[0][0].operador;

describe('conteudoParaOModelo', () => {
  const gravado = conteudoParaOModelo(conteudo);

  it('põe o operador da exibição da etapa no código do contrato', () => {
    expect(gravado.etapas?.[0].exibicao?.[0][0].operador).toBe(OperadorCodigo.IGUAL);
  });

  it('põe o operador de cada predicado do item no código do contrato', () => {
    const regras = gravado.itens?.[0].regras;
    const predicados = [
      regras?.exibicao,
      regras?.obrigatoriedade?.predicado,
      regras?.impedimento?.quando,
      regras?.restricoes?.[0].entradas?.[0].quando,
    ];

    expect(predicados.map(operadorDe)).toEqual(Array(4).fill(OperadorCodigo.IGUAL));
  });

  it('converte os predicados dos grupos, dos termos e dos documentos exigidos', () => {
    const [grupo] = gravado.grupos ?? [];
    const predicados = [
      grupo.regras?.exibicao,
      grupo.subitens[0].regras?.exibicao,
      gravado.termos?.[0].regras?.exibicao,
      gravado.documentosExigidos?.[0].quando,
    ];

    expect(predicados.map(operadorDe)).toEqual(Array(4).fill(OperadorCodigo.IGUAL));
  });

  it('põe o tipo de renderização no código do contrato', () => {
    expect(gravado.itens?.[0].apresentacao?.tipoRenderizacao).toBe(TipoRenderizacaoCodigo.BOOLEANO);
  });

  it('deixa nulo o código que o contrato não conhece, para a API recusar', () => {
    const [desconhecido] = conteudoParaOModelo(comCodigosDesconhecidos).itens ?? [];

    expect(desconhecido.apresentacao?.tipoRenderizacao).toBeNull();
    expect(desconhecido.regras?.exibicao?.[0][0].operador).toBeNull();
  });

  it('mantém sem predicado o que veio sem predicado', () => {
    const sem = conteudoParaOModelo({
      ...conteudo,
      itens: [{ ...item, regras: semPredicado }],
      etapas: null,
      grupos: undefined,
      termos: null,
      documentosExigidos: undefined,
    });

    expect(sem.itens?.[0].regras?.exibicao).toBeNull();
    expect(sem.itens?.[0].regras?.impedimento).toBeUndefined();
    expect(sem.etapas).toBeNull();
  });
});

describe('conteudoDoModelo', () => {
  const lido = conteudoDoModelo(modelo.conteudo);
  const [nome, escolaPublica] = lido.itens ?? [];

  it('troca o tipo de renderização e o operador pelo texto do código', () => {
    expect(escolaPublica.apresentacao.tipoRenderizacao).toBe('BOOLEANO');
    expect(escolaPublica.regras.impedimento?.quando?.[0][0].operador).toBe('IGUAL');
  });

  it('mantém nulo o que o modelo devolve sem predicado', () => {
    expect(nome.regras.exibicao).toBeNull();
    expect(nome.regras.obrigatoriedade.predicado).toBeNull();
  });

  it('entrega os blocos do grupo e do termo como o modelo os devolve', () => {
    expect(lido.grupos?.[0].ocorrencias).toEqual({
      minimo: 1,
      maximo: null,
      incluiCandidato: true,
    });
    expect(lido.termos?.[0].termo).toEqual({ termoId: 'T1', versaoId: 'V1' });
  });
});
