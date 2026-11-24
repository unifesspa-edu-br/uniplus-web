import { describe, expect, it } from 'vitest';
import {
  TipoEtapaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  FinalidadeFormularioCodigo,
  type FatoColetadoDto,
  type FormularioDto,
  OperadorCodigo,
  TipoRenderizacaoCodigo,
} from '@uniplus/shared-data/selecao';
import type { ConteudoDoFormulario } from '@uniplus/shared-ui/components';
import { conteudoDoFormulario, itensParaEnvio, planoDeGravacao } from './formulario-do-processo';

type RegrasDoFato = FatoColetadoDto['regras'];

const regras = (extra: Partial<RegrasDoFato> = {}): RegrasDoFato => ({
  exibicao: null,
  obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
  restricoes: [],
  impedimento: null,
  ...extra,
});

const fato = (
  fatoCodigo: string,
  ordem: number,
  etapaCodigo: string,
  extra: Partial<FatoColetadoDto> = {},
): FatoColetadoDto => ({
  fatoCodigo,
  ordem,
  etapaCodigo,
  apresentacao: {
    rotulo: fatoCodigo,
    tipoRenderizacao: TipoRenderizacaoCodigo.SIM_OU_NAO,
    ajuda: null,
    pedirConfirmacao: false,
  },
  regras: regras(),
  formato: null,
  opcoes: null,
  ...extra,
});

const etapa = (codigo: string, ordem: number): FormularioDto['etapas'][number] => ({
  codigo,
  ordem,
  tipo: TipoEtapaFormularioCodigo.SECAO,
  bloco: null,
  apresentacao: { titulo: codigo, descricao: null, aviso: null },
  exibicao: null,
});

const inscricao: FormularioDto = {
  finalidade: { codigo: FinalidadeFormularioCodigo.INSCRICAO, rotulo: 'Inscrição' },
  faseId: 'F1',
  titulo: 'Inscrição',
  modeloOrigem: null,
  etapas: [etapa('DADOS_BASICOS', 0), etapa('S1', 1), etapa('S2', 2)],
  coleta: {
    itens: [
      fato('NOME', 0, 'DADOS_BASICOS'),
      fato('A', 1, 'S1', {
        regras: regras({
          obrigatoriedade: {
            tipo: TipoObrigatoriedadeCodigo.QUANDO,
            predicado: [[{ fato: 'NOME', operador: OperadorCodigo.IGUAL, valor: 'X' }]],
          },
        }),
      }),
      fato('B', 2, 'S2'),
    ],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 3,
        etapaCodigo: 'S2',
        rotulo: 'Família',
        ocorrencias: { minimo: 1, maximo: null, incluiCandidato: true },
        regras: {
          exibicao: null,
          obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
        },
        subitens: [fato('PARENTESCO', 0, '')],
      },
    ],
  },
  termos: [],
};

describe('formulário do processo no editor', () => {
  it('traz a obrigatoriedade em token e predicado, também nos campos de grupo, e sem pressuposto', () => {
    const conteudo = conteudoDoFormulario(inscricao);

    expect(conteudo.itens?.[1].regras.obrigatoriedade).toEqual({
      tipo: TipoObrigatoriedadeCodigo.QUANDO,
      predicado: [[{ fato: 'NOME', operador: OperadorCodigo.IGUAL, valor: 'X' }]],
    });
    expect(conteudo.grupos?.[0].subitens[0]).toMatchObject({
      fatoCodigo: 'PARENTESCO',
      regras: { obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE } },
    });
    expect(conteudo.pressupostos).toEqual([]);
  });

  it('o envio dos itens vai sem os dados básicos, que a API repõe, e sempre com a lista de grupos', () => {
    const enviado = itensParaEnvio(conteudoDoFormulario(inscricao));
    if (enviado === null) throw new Error('Esperava o corpo dos itens.');

    expect(enviado.itens.map((i) => i.fatoCodigo)).toEqual(['A', 'B']);
    expect(enviado.grupos?.map((g) => g.codigo)).toEqual(['FAMILIA']);
  });
});

describe('planoDeGravacao', () => {
  const servidor = { faseId: 'F1', conteudo: conteudoDoFormulario(inscricao) };
  const com = (mudanca: (c: ConteudoDoFormulario) => ConteudoDoFormulario) => ({
    faseId: 'F1',
    conteudo: mudanca(servidor.conteudo),
  });

  it('o formulário novo grava o cabeçalho antes dos itens: os itens exigem o formulário criado', () => {
    expect(planoDeGravacao(null, servidor)).toEqual(['cabecalho', 'itens']);
  });

  it('sem mudança, não grava nada', () => {
    expect(planoDeGravacao(servidor, servidor)).toEqual([]);
  });

  it('só o rótulo de um item mudou: só os itens', () => {
    const plano = planoDeGravacao(
      servidor,
      com((c) => ({
        ...c,
        itens:
          c.itens?.map((i) =>
            i.fatoCodigo === 'B'
              ? { ...i, apresentacao: { ...i.apresentacao, rotulo: 'Novo' } }
              : i,
          ) ?? [],
      })),
    );
    expect(plano).toEqual(['itens']);
  });

  it('seções trocadas de lugar com os itens: itens sem seção, cabeçalho, e itens de novo', () => {
    const trocado = com((c) => ({
      ...c,
      etapas:
        c.etapas?.map((e) =>
          e.codigo === 'S1' ? { ...e, ordem: 2 } : e.codigo === 'S2' ? { ...e, ordem: 1 } : e,
        ) ?? [],
      itens:
        c.itens?.map((i) =>
          i.fatoCodigo === 'A' ? { ...i, ordem: 2 } : i.fatoCodigo === 'B' ? { ...i, ordem: 1 } : i,
        ) ?? [],
    }));

    expect(planoDeGravacao(servidor, trocado)).toEqual(['itensSemSecao', 'cabecalho', 'itens']);
  });

  it('só uma seção acrescentada, com um item nela: cabeçalho, depois itens', () => {
    const comSecao = com((c) => ({
      ...c,
      etapas: [...(c.etapas ?? []), etapa('S3', 3)],
      itens: [
        ...(c.itens ?? []),
        {
          ...(c.itens?.[2] as NonNullable<typeof c.itens>[number]),
          fatoCodigo: 'C',
          ordem: 4,
          etapaCodigo: 'S3',
        },
      ],
    }));

    expect(planoDeGravacao(servidor, comSecao)).toEqual(['cabecalho', 'itens']);
  });

  it('os itens sem seção vão sem seção também nos grupos', () => {
    const enviado = itensParaEnvio(servidor.conteudo, true);
    if (enviado === null) throw new Error('Esperava o corpo dos itens.');
    expect(
      [...enviado.itens, ...(enviado.grupos ?? [])].every(
        (entrada) => entrada.etapaCodigo === null,
      ),
    ).toBe(true);
  });

  it('o conteúdo lido do servidor e não editado gera plano vazio, com todas as regras e termos', () => {
    const comTudo: FormularioDto = {
      ...inscricao,
      termos: [
        {
          codigo: 'TERMO',
          ordem: 5,
          termo: {
            termoId: 't',
            versaoId: 'v',
            termoCodigo: 'T',
            versaoNumero: 1,
            conteudo: {
              nome: 'Termo',
              texto: 'Texto',
              baseLegal: 'LGPD',
              formaAceite: {
                codigo:
                  'REGISTRO_SEM_ENDERECO_IP' as FormularioDto['termos'][number]['termo']['conteudo']['formaAceite']['codigo'],
                rotulo: 'Registro sem endereço IP',
              },
              hashVersao: 'h',
            },
          },
          regras: {
            exibicao: [],
            obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
          },
        },
      ],
    };
    const lido = { faseId: 'F1', conteudo: conteudoDoFormulario(comTudo) };

    expect(
      planoDeGravacao(lido, { faseId: 'F1', conteudo: conteudoDoFormulario(comTudo) }),
    ).toEqual([]);
    expect(lido.conteudo.termos?.[0]).toMatchObject({
      termo: { termoId: 't', versaoId: 'v' },
      regras: { exibicao: null },
    });
  });

  it('o limite de ocorrências do grupo e a inclusão do candidato vêm do bloco de ocorrências', () => {
    expect(conteudoDoFormulario(inscricao).grupos?.[0].ocorrencias).toEqual({
      minimo: 1,
      maximo: null,
      incluiCandidato: true,
    });
  });

  it('só o título mudou: só o cabeçalho', () => {
    expect(
      planoDeGravacao(
        servidor,
        com((c) => ({ ...c, titulo: 'Outro' })),
      ),
    ).toEqual(['cabecalho']);
  });

  it('a fase mudou: o cabeçalho leva a fase nova', () => {
    expect(planoDeGravacao(servidor, { faseId: 'F2', conteudo: servidor.conteudo })).toEqual([
      'cabecalho',
    ]);
  });

  it('a faixa de data lida do processo volta inteira no envio, com os dois limites', () => {
    const faixa = {
      tipo: 'FAIXA_DE_DATA',
      minimo: null,
      maximo: null,
      entradas: null,
      fatos: null,
      dataMinima: { ancora: 'ENVIO', data: null, anos: -120, dias: 0 },
      dataMaxima: { ancora: 'DATA_FIXA', data: '2030-12-31', anos: 0, dias: 0 },
    };
    const comFaixa: FormularioDto = {
      ...inscricao,
      coleta: {
        itens: [
          fato('NASCIMENTO', 0, 'S1', {
            apresentacao: {
              rotulo: 'NASCIMENTO',
              tipoRenderizacao: TipoRenderizacaoCodigo.DATA,
              ajuda: null,
              pedirConfirmacao: false,
            },
            regras: regras({ restricoes: [faixa] }),
          }),
        ],
        grupos: [],
      },
    };

    const enviado = itensParaEnvio(conteudoDoFormulario(comFaixa));
    if (enviado === null) throw new Error('Esperava o corpo dos itens.');

    expect(enviado.itens[0].regras?.restricoes).toEqual([faixa]);
  });

  it('não monta o corpo dos itens quando um limite digitado não é número', () => {
    const conteudo = conteudoDoFormulario(inscricao);
    const comTexto = {
      ...conteudo,
      itens: (conteudo.itens ?? []).map((item) => ({
        ...item,
        regras: { ...item.regras, restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 'abc' }] },
      })),
    };

    expect(itensParaEnvio(comTexto)).toBeNull();
  });
});
