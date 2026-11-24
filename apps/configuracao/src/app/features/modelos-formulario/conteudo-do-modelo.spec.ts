import {
  BlocoSistemaCodigo,
  EfeitoNaAnaliseDoDocumentoCodigo,
  EscolhaDaValidadeCodigo,
  EscolhaDoPrazoDeEmissaoCodigo,
  OperadorCodigo,
  TipoDaDataDeReferenciaCodigo,
  TipoEtapaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  TipoRenderizacaoCodigo,
  UnidadeDoPrazoDeEmissaoCodigo,
} from '@uniplus/shared-data/configuracao';
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
    tipoRenderizacao: 'SIM_OU_NAO',
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
  gruposDeDocumentos: [
    {
      quantidadeMinima: 1,
      indeferimento: { consequencia: 'ELIMINA', basesLegais: [] },
      documentos: [
        {
          faseCodigo: 'INSCRICAO',
          tipoDocumentoCodigo: 'CPF',
          obrigatorio: false,
          quando: QUANDO,
          consequenciaIndeferimento: 'ELIMINA',
          basesLegais: null,
        },
      ],
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

  it('converte os predicados dos grupos e dos termos', () => {
    const [grupo] = gravado.grupos ?? [];
    const predicados = [
      grupo.regras?.exibicao,
      grupo.subitens[0].regras?.exibicao,
      gravado.termos?.[0].regras?.exibicao,
    ];

    expect(predicados.map(operadorDe)).toEqual(Array(3).fill(OperadorCodigo.IGUAL));
  });

  it('converte os predicados dos documentos exigidos e dos documentos dos grupos', () => {
    const { documentosExigidos, gruposDeDocumentos } = gravado.conjuntoDeDocumentos ?? {};
    const predicados = [
      documentosExigidos?.[0].quando,
      gruposDeDocumentos?.[0].documentos?.[0].quando,
    ];

    expect(predicados.map(operadorDe)).toEqual(Array(2).fill(OperadorCodigo.IGUAL));
  });

  it('põe o tipo de renderização no código do contrato', () => {
    expect(gravado.itens?.[0].apresentacao?.tipoRenderizacao).toBe(
      TipoRenderizacaoCodigo.SIM_OU_NAO,
    );
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
      gruposDeDocumentos: undefined,
    });

    expect(sem.itens?.[0].regras?.exibicao).toBeNull();
    expect(sem.itens?.[0].regras?.impedimento).toBeUndefined();
    expect(sem.etapas).toBeNull();
  });

  it('põe o tipo e o bloco da etapa e a obrigatoriedade nos códigos do contrato', () => {
    const gravadoComBloco = conteudoParaOModelo({
      ...conteudo,
      etapas: (conteudo.etapas ?? []).map((etapa) => ({
        ...etapa,
        tipo: 'BLOCO',
        bloco: 'REVISAO_E_ACEITE',
      })),
    });

    expect(gravadoComBloco.etapas?.[0]).toMatchObject({
      tipo: TipoEtapaFormularioCodigo.BLOCO,
      bloco: BlocoSistemaCodigo.REVISAO_E_ACEITE,
    });
    expect(gravado.etapas?.[0]).toMatchObject({
      tipo: TipoEtapaFormularioCodigo.SECAO,
      bloco: null,
    });
    expect(gravado.itens?.[0].regras?.obrigatoriedade?.tipo).toBe(TipoObrigatoriedadeCodigo.QUANDO);
    expect(gravado.termos?.[0].regras?.obrigatoriedade?.tipo).toBe(
      TipoObrigatoriedadeCodigo.QUANDO,
    );
  });

  it('recusa gravar etapa com tipo ou bloco que o contrato não conhece', () => {
    const etapa = (conteudo.etapas ?? [])[0];

    expect(() =>
      conteudoParaOModelo({ ...conteudo, etapas: [{ ...etapa, tipo: 'INVENTADO' }] }),
    ).toThrow('Código fora do contrato: INVENTADO');
    expect(() =>
      conteudoParaOModelo({
        ...conteudo,
        etapas: [{ ...etapa, tipo: 'BLOCO', bloco: 'INVENTADO' }],
      }),
    ).toThrow('Código fora do contrato: INVENTADO');
  });

  it('agrupa o indeferimento do documento e leva os grupos dentro do conjunto', () => {
    const { documentosExigidos, gruposDeDocumentos } = gravado.conjuntoDeDocumentos ?? {};

    expect(documentosExigidos?.[0]).toMatchObject({
      indeferimento: { obrigatorio: true, consequencia: 'ELIMINA', basesLegais: null },
    });
    expect(documentosExigidos?.[0]).not.toHaveProperty('consequenciaIndeferimento');
    expect(gruposDeDocumentos?.[0]).toMatchObject({
      quantidadeMinima: 1,
      indeferimento: { consequencia: 'ELIMINA', basesLegais: [] },
    });
    expect(gruposDeDocumentos?.[0].documentos?.[0].indeferimento).toMatchObject({
      obrigatorio: false,
    });
  });

  it('grava os requisitos só com os códigos, como o modelo os recebe', () => {
    const lidoDoModelo = conteudoDoModelo(modelo.conteudo);

    const [laudo, certidao] =
      conteudoParaOModelo(lidoDoModelo as ConteudoDoFormulario<number>).conjuntoDeDocumentos
        ?.documentosExigidos ?? [];

    expect(laudo.requisitos).toEqual({
      prazoDeEmissao: {
        escolha: EscolhaDoPrazoDeEmissaoCodigo.COM_PRAZO,
        valor: 90,
        unidade: UnidadeDoPrazoDeEmissaoCodigo.DIAS,
        referencia: {
          tipo: TipoDaDataDeReferenciaCodigo.FIM_DAS_INSCRICOES,
          data: null,
          faseCodigo: null,
        },
        efeitoForaDoPrazo: EfeitoNaAnaliseDoDocumentoCodigo.RECUSAR_DOCUMENTO,
      },
      validade: {
        escolha: EscolhaDaValidadeCodigo.EXIGE_DOCUMENTO_VALIDO,
        referencia: null,
        efeitoDoVencimento: EfeitoNaAnaliseDoDocumentoCodigo.ACEITAR_COM_AVISO,
      },
    });
    expect(certidao.requisitos).toEqual({ prazoDeEmissao: null, validade: null });
  });
});

describe('conteudoDoModelo', () => {
  const lido = conteudoDoModelo(modelo.conteudo);
  const [nome, escolaPublica] = lido.itens ?? [];

  it('troca o tipo de renderização e o operador pelo texto do código', () => {
    expect(escolaPublica.apresentacao.tipoRenderizacao).toBe('SIM_OU_NAO');
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

  it('desdobra o indeferimento do documento em campos que a tela edita', () => {
    const [laudo, certidao] = lido.documentosExigidos ?? [];

    expect(laudo).toMatchObject({
      obrigatorio: true,
      consequenciaIndeferimento: 'ELIMINA',
      basesLegais: [{ referencia: 'Lei 13.146/2015' }],
    });
    expect(certidao).toMatchObject({
      obrigatorio: false,
      consequenciaIndeferimento: 'ABRE_PRAZO_PARA_REENVIO',
    });
    expect(laudo).not.toHaveProperty('indeferimento');
  });

  it('lê os requisitos pelo código, sem o rótulo', () => {
    const [laudo, certidao] = lido.documentosExigidos ?? [];

    expect(laudo.requisitos?.prazoDeEmissao).toMatchObject({
      escolha: 'COM_PRAZO',
      valor: 90,
      unidade: 'DIAS',
      efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
      referencia: { tipo: 'FIM_DAS_INSCRICOES' },
    });
    expect(laudo.requisitos?.validade).toMatchObject({ escolha: 'EXIGE_DOCUMENTO_VALIDO' });
    expect(certidao.requisitos).toEqual({ prazoDeEmissao: null, validade: null });
  });

  it('traz os grupos de documentos com os documentos desdobrados', () => {
    const comGrupo = conteudoDoModelo({
      ...modelo.conteudo,
      conjuntoDeDocumentos: {
        ...modelo.conteudo.conjuntoDeDocumentos,
        gruposDeDocumentos: [
          {
            quantidadeMinima: 1,
            indeferimento: null,
            documentos: [modelo.conteudo.conjuntoDeDocumentos.documentosExigidos[1]],
          },
        ],
      },
    });

    expect(comGrupo.gruposDeDocumentos?.[0].documentos[0]).toMatchObject({
      tipoDocumentoCodigo: 'CERTIDAO_NASCIMENTO',
      obrigatorio: false,
    });
    expect(comGrupo.gruposDeDocumentos?.[0].indeferimento).toBeNull();
  });
});
