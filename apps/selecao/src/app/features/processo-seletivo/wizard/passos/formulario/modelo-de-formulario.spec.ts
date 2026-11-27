import {
  TipoObrigatoriedadeCodigo,
  type AplicacaoDeModeloDto,
  type FormularioDto,
  TipoDeCampoCodigo,
} from '@uniplus/shared-data/selecao';
import {
  apresentacaoDoCampo,
  conteudoInicial,
  REGRAS_INICIAIS,
  type ConteudoDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import type {
  FormularioDeInscricao,
  FormularioDoProcessoNoRascunho,
} from '../../processo-seletivo.models';
import { formularioCom, formularioDoRascunho } from './formulario-de-inscricao.testing';
import { modelo } from './formulario-gravado.testing';
import {
  comAplicacaoDoServidor,
  modelosOferecidos,
  modelosQueServem,
  resumoDaAplicacao,
} from './modelo-de-formulario';

const item = (fatoCodigo: string): ItemDoFormulario => ({
  fatoCodigo,
  ordem: 0,
  paginaCodigo: null,
  apresentacao: apresentacaoDoCampo(fatoCodigo, 'SIM_OU_NAO'),
  regras: REGRAS_INICIAIS,
});
const com = (...fatos: string[]): ConteudoDoFormulario => ({
  ...conteudoInicial(),
  itens: fatos.map(item),
});

/** O formulário como o servidor o devolve, só com itens e a revisão e aceite. */
const doServidor = (
  codigo: string,
  faseId: string | null,
  fatos: readonly string[],
  modeloOrigemCodigo: string | null = null,
): FormularioDto => ({
  codigo,
  faseId,
  obrigatorio: true,
  titulo: null,
  modeloOrigem: modeloOrigemCodigo === null ? null : { id: 'm', codigo: modeloOrigemCodigo },
  paginas: [],
  coleta: {
    itens: fatos.map((fatoCodigo, ordem) => ({
      fatoCodigo,
      ordem,
      paginaCodigo: null,
      apresentacao: {
        rotulo: fatoCodigo,
        tipoDeCampo: TipoDeCampoCodigo.SIM_OU_NAO,
        ajuda: null,
        pedirConfirmacao: false,
      },
      regras: {
        exibicao: null,
        obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
        restricoes: [],
        impedimento: null,
      },
      formato: null,
      opcoes: null,
    })),
    grupos: [],
  },
  termos: [],
});

const relato = (extra: Partial<AplicacaoDeModeloDto> = {}): AplicacaoDeModeloDto => ({
  formularioCodigo: 'INSCRICAO',
  fatosTrazidosParaAInscricao: [],
  fatosMantidosNaInscricao: [],
  descartados: [],
  derivacoesCopiadas: [],
  derivacoesMantidas: [],
  ...extra,
});

const FASES = [
  { id: 'F-INSCRICAO', codigo: 'INSCRICAO', faseCanonica: { coletaInscricao: true } },
  { id: 'F-HABILITACAO', codigo: 'HABILITACAO', faseCanonica: { coletaInscricao: false } },
];

const rascunho = (
  extra: Partial<FormularioDeInscricao> = {},
  outros: readonly FormularioDoProcessoNoRascunho[] = [],
): FormularioDeInscricao => formularioCom(com('PCD'), extra, outros);

const habilitacaoEditada = () =>
  formularioDoRascunho(com('RENDA'), { codigo: 'HABILITACAO', faseCodigo: 'HABILITACAO' });

describe('os modelos oferecidos', () => {
  it('saem por nome, com o que cada um declara', () => {
    const oferecidos = modelosOferecidos([
      modelo('b', 'Vestibular', 'INSCRICAO'),
      modelo('h', 'Habilitação padrão', 'HABILITACAO'),
      modelo('a', 'Medicina', 'INSCRICAO'),
    ]);

    expect(oferecidos.map((oferecido) => oferecido.nome)).toEqual([
      'Habilitação padrão',
      'Medicina',
      'Vestibular',
    ]);
    expect(oferecidos[0]).toMatchObject({ id: 'h', serveAFaseDeInscricao: false });
  });

  it('a fase de inscrição recebe os modelos dela, as outras, os demais, e sem fase todos', () => {
    const oferecidos = modelosOferecidos([
      modelo('i', 'Inscrição', 'INSCRICAO'),
      modelo('h', 'Habilitação', 'HABILITACAO'),
    ]);
    const daInscricao = { codigo: 'A', coletaInscricao: true, coletaSolicitacaoIsencao: false };
    const outra = { ...daInscricao, coletaInscricao: false };

    expect(modelosQueServem(oferecidos, daInscricao).map((m) => m.id)).toEqual(['i']);
    expect(modelosQueServem(oferecidos, outra).map((m) => m.id)).toEqual(['h']);
    expect(modelosQueServem(oferecidos, undefined)).toHaveLength(2);
  });

  it('na fase que coleta inscrição e isenção, o obrigatório recebe os da inscrição e o facultativo, os demais', () => {
    const oferecidos = modelosOferecidos([
      modelo('i', 'Inscrição', 'INSCRICAO'),
      modelo('s', 'Pedido de isenção', 'HABILITACAO'),
    ]);
    const dividida = { codigo: 'A', coletaInscricao: true, coletaSolicitacaoIsencao: true };

    expect(modelosQueServem(oferecidos, dividida, true).map((m) => m.id)).toEqual(['i']);
    expect(modelosQueServem(oferecidos, dividida, false).map((m) => m.id)).toEqual(['s']);
    expect(modelosQueServem(oferecidos, dividida)).toHaveLength(2);
  });
});

describe('o rascunho depois da aplicação', () => {
  it('recebe a cópia no código aplicado, com a origem e a fase da aba, e deixa as outras abas como estão', () => {
    const editada = formularioDoRascunho(com('RENDA'), {
      codigo: 'ISENCAO_TAXA',
      faseCodigo: 'INSCRICAO',
      obrigatorio: false,
    });
    const servidor = {
      formularios: [
        doServidor('INSCRICAO', 'F-INSCRICAO', ['PCD']),
        doServidor('HABILITACAO', null, ['DIPLOMA'], 'HAB-PADRAO'),
      ],
      cronogramaFases: FASES,
      regrasDerivacao: [],
    };

    const depois = comAplicacaoDoServidor(
      rascunho({}, [editada, habilitacaoEditada()]),
      servidor,
      relato({ formularioCodigo: 'HABILITACAO' }),
      'HABILITACAO',
    );

    const habilitacao = depois.formularios.find((outro) => outro.codigo === 'HABILITACAO');
    expect(habilitacao?.faseCodigo).toBe('HABILITACAO');
    expect(habilitacao?.modeloOrigemCodigo).toBe('HAB-PADRAO');
    expect(habilitacao?.conteudo.itens?.map((i) => i.fatoCodigo)).toEqual(['DIPLOMA']);
    expect(
      depois.formularios.find((outro) => outro.codigo === 'ISENCAO_TAXA'),
      'a edição não gravada da outra aba fica',
    ).toBe(editada);
  });

  it('na inscrição, o formulário de onde a cópia trouxe fatos volta ao que o servidor deixou', () => {
    const servidor = {
      formularios: [
        doServidor('INSCRICAO', 'F-INSCRICAO', ['RENDA'], 'INSC'),
        doServidor('ISENCAO_TAXA', 'F-INSCRICAO', ['NIS']),
      ],
      cronogramaFases: FASES,
      regrasDerivacao: [],
    };
    const isencao = formularioDoRascunho(com('RENDA', 'NIS'), {
      codigo: 'ISENCAO_TAXA',
      faseCodigo: 'INSCRICAO',
      obrigatorio: false,
    });

    const depois = comAplicacaoDoServidor(
      rascunho({}, [isencao]),
      servidor,
      relato({ fatosTrazidosParaAInscricao: ['RENDA'] }),
      'INSCRICAO',
    );

    const [inscricao, outro] = depois.formularios;
    expect(inscricao.conteudo.itens?.map((i) => i.fatoCodigo)).toEqual(['RENDA']);
    expect(inscricao.modeloOrigemCodigo).toBe('INSC');
    expect(outro.conteudo.itens?.map((i) => i.fatoCodigo)).toEqual(['NIS']);
  });

  it('o formulário que o servidor não devolveu deixa o rascunho como está', () => {
    const antes = rascunho();
    const servidor = { formularios: [], cronogramaFases: FASES, regrasDerivacao: [] };

    expect(comAplicacaoDoServidor(antes, servidor, relato(), 'INSCRICAO')).toBe(antes);
  });

  it('as derivações copiadas do catálogo somam-se às do rascunho, sem trocar as outras', () => {
    const servidor = {
      formularios: [doServidor('INSCRICAO', 'F-INSCRICAO', ['PCD'])],
      cronogramaFases: FASES,
      regrasDerivacao: [
        { codigoFato: 'COTISTA', regras: ['do servidor'] },
        { codigoFato: 'RENDA_PER_CAPITA', regras: ['do catálogo'] },
      ],
    };
    const editada = { codigoFato: 'COTISTA', regras: ['editada no rascunho'] };

    const depois = comAplicacaoDoServidor(
      rascunho({ derivacao: [editada] }),
      servidor,
      relato({ derivacoesCopiadas: ['RENDA_PER_CAPITA'] }),
      'INSCRICAO',
    );

    expect(depois.derivacao).toEqual([
      editada,
      { codigoFato: 'RENDA_PER_CAPITA', regras: ['do catálogo'] },
    ]);
  });
});

describe('o resumo da aplicação', () => {
  it('diz os campos acrescentados, os fatos mantidos na inscrição e o que ficou fora da cópia, pelo nome', () => {
    const nomes: Record<string, string> = {
      PCD: 'Pessoa com deficiência',
      NIS: 'NIS',
      RENDA: 'Renda',
    };
    const resumo = resumoDaAplicacao(
      relato({
        formularioCodigo: 'ISENCAO_TAXA',
        fatosMantidosNaInscricao: ['RENDA'],
        descartados: [{ parte: 'ITEM', codigo: 'NIS', motivo: 'FATO_DESATIVADO' }],
      }),
      'Isenção padrão',
      ['PCD'],
      (codigo) => nomes[codigo] ?? codigo,
    ).join(' ');

    expect(resumo).toContain(
      'Acrescentados porque o processo os pressupõe (exigências documentais, derivação ou desempate): Pessoa com deficiência.',
    );
    expect(resumo).toContain(
      'Mantidos no formulário de inscrição, que já os coleta, e fora desta cópia: Renda.',
    );
    expect(resumo).toContain('NIS (desativado no catálogo)');
  });
});
