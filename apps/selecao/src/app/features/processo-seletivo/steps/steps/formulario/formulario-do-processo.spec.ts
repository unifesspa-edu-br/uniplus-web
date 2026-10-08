import { describe, expect, it } from 'vitest';
import type { FatoColetadoDto, FormularioDto } from '@uniplus/shared-data/selecao';
import type { ConteudoDoFormulario } from '@uniplus/shared-ui/components';
import { conteudoDoFormulario, itensParaEnvio, planoDeGravacao } from './formulario-do-processo';

const fato = (
  fatoCodigo: string,
  ordem: number,
  etapaCodigo: string,
  extra: Partial<FatoColetadoDto> = {},
): FatoColetadoDto => ({
  fatoCodigo,
  ordem,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
  precondicao: null,
  opcoes: null,
  etapaCodigo,
  formato: null,
  ajuda: null,
  pedirConfirmacao: false,
  restricoes: [],
  impedimento: null,
  ...extra,
});

const etapa = (codigo: string, ordem: number) => ({
  codigo,
  ordem,
  tipo: 'SECAO',
  bloco: null,
  titulo: codigo,
  descricao: null,
  aviso: null,
  exibicao: null,
});

const inscricao: FormularioDto = {
  finalidade: 'INSCRICAO',
  faseId: 'F1',
  titulo: 'Inscrição',
  modeloOrigemId: null,
  modeloOrigemCodigo: null,
  etapas: [etapa('DADOS_BASICOS', 0), etapa('S1', 1), etapa('S2', 2)],
  fatosColetados: [
    fato('NOME', 0, 'DADOS_BASICOS'),
    fato('A', 1, 'S1', {
      obrigatoriedade: {
        tipo: 'QUANDO',
        predicado: [[{ fato: 'NOME', operador: 'IGUAL', valor: 'X' }]],
      },
    }),
    fato('B', 2, 'S2'),
  ],
  termos: [],
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 3,
      etapaCodigo: 'S2',
      rotulo: 'Família',
      minimo: 1,
      maximo: null,
      incluiCandidato: true,
      exibicao: null,
      obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
      subitens: [fato('PARENTESCO', 0, '')],
    },
  ],
};

describe('formulário do processo no editor', () => {
  it('traz a obrigatoriedade em token e predicado, também nos campos de grupo, e sem pressuposto', () => {
    const conteudo = conteudoDoFormulario(inscricao);

    expect(conteudo.itens?.[1]).toMatchObject({
      obrigatoriedade: 'QUANDO',
      predicadoObrigatoriedade: [[{ fato: 'NOME', operador: 'IGUAL', valor: 'X' }]],
    });
    expect(conteudo.grupos?.[0].subitens[0]).toMatchObject({
      fatoCodigo: 'PARENTESCO',
      obrigatoriedade: 'SEMPRE',
    });
    expect(conteudo.pressupostos).toEqual([]);
  });

  it('o envio dos itens vai sem os dados básicos, que a API repõe, e sempre com a lista de grupos', () => {
    const enviado = itensParaEnvio(conteudoDoFormulario(inscricao));

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
        itens: c.itens?.map((i) => (i.fatoCodigo === 'B' ? { ...i, rotulo: 'Novo' } : i)) ?? [],
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
    expect(
      [...enviado.itens, ...(enviado.grupos ?? [])].every(
        (entrada) => entrada.etapaCodigo === null,
      ),
    ).toBe(true);
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
});
