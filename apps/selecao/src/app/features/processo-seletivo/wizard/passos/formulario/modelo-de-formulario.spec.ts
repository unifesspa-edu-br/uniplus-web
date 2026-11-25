import {
  FinalidadeFormularioCodigo,
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

import type { FormularioDeInscricao } from '../../processo-seletivo.models';
import { modelo } from './formulario-gravado.testing';
import {
  comAplicacaoDoServidor,
  faseQueAAplicacaoDeclara,
  modelosPorFinalidade,
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
  finalidade: FinalidadeFormularioCodigo,
  faseId: string | null,
  fatos: readonly string[],
  modeloOrigemCodigo: string | null = null,
): FormularioDto => ({
  finalidade: { codigo: finalidade, rotulo: finalidade },
  faseId,
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
  finalidade: { codigo: FinalidadeFormularioCodigo.INSCRICAO, rotulo: 'Inscrição' },
  fatosTrazidosParaAInscricao: [],
  fatosMantidosNaInscricao: [],
  descartados: [],
  derivacoesCopiadas: [],
  derivacoesMantidas: [],
  ...extra,
});

const FASES = [
  { id: 'F-INSCRICAO', codigo: 'INSCRICAO' },
  { id: 'F-HABILITACAO', codigo: 'HABILITACAO' },
];

const rascunho = (extra: Partial<FormularioDeInscricao> = {}): FormularioDeInscricao => ({
  faseCodigo: 'INSCRICAO',
  conteudo: com('PCD'),
  referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
  derivacao: [],
  outrasFinalidades: [],
  ...extra,
});

describe('os modelos oferecidos', () => {
  it('cada finalidade oferece só os modelos dela, por nome', () => {
    const porFinalidade = modelosPorFinalidade([
      modelo('b', 'Vestibular', 'INSCRICAO'),
      modelo('h', 'Habilitação padrão', 'HABILITACAO'),
      modelo('a', 'Medicina', 'INSCRICAO'),
    ]);

    expect(porFinalidade.get('INSCRICAO')?.map((oferecido) => oferecido.nome)).toEqual([
      'Medicina',
      'Vestibular',
    ]);
    expect(porFinalidade.get('HABILITACAO')?.map((oferecido) => oferecido.id)).toEqual(['h']);
    expect(porFinalidade.get('ISENCAO_TAXA')).toBeUndefined();
  });
});

describe('a fase que a aplicação declara', () => {
  it('a do formulário que já tem fase no servidor é preservada pela cópia', () => {
    expect(
      faseQueAAplicacaoDeclara(
        doServidor(FinalidadeFormularioCodigo.INSCRICAO, 'F-INSCRICAO', []),
        'INSCRICAO',
        FASES,
      ),
    ).toEqual({ declarar: false });
  });

  it('o formulário que nasce da cópia recebe a fase da aba, e sem ela no cronograma gravado não há o que declarar', () => {
    expect(faseQueAAplicacaoDeclara(null, 'HABILITACAO', FASES)).toEqual({
      declarar: true,
      faseId: 'F-HABILITACAO',
    });
    expect(
      faseQueAAplicacaoDeclara(
        doServidor(FinalidadeFormularioCodigo.HABILITACAO, null, []),
        'HABILITACAO',
        FASES,
      ),
    ).toEqual({ declarar: true, faseId: 'F-HABILITACAO' });
    expect(faseQueAAplicacaoDeclara(null, 'HABILITACAO', [FASES[0]])).toEqual({
      declarar: true,
      faseId: null,
    });
  });
});

describe('o rascunho depois da aplicação', () => {
  it('recebe a cópia na finalidade aplicada, com a origem e a fase da aba, e deixa as outras abas como estão', () => {
    const editada = { finalidade: 'ISENCAO_TAXA', faseCodigo: 'INSCRICAO', conteudo: com('RENDA') };
    const servidor = {
      formularios: [
        doServidor(FinalidadeFormularioCodigo.INSCRICAO, 'F-INSCRICAO', ['PCD']),
        doServidor(FinalidadeFormularioCodigo.HABILITACAO, null, ['DIPLOMA'], 'HAB-PADRAO'),
      ],
      cronogramaFases: FASES,
      regrasDerivacao: [],
    };

    const depois = comAplicacaoDoServidor(
      rascunho({ outrasFinalidades: [editada] }),
      servidor,
      relato({
        finalidade: { codigo: FinalidadeFormularioCodigo.HABILITACAO, rotulo: 'Habilitação' },
      }),
      'HABILITACAO',
    );

    const habilitacao = depois.outrasFinalidades.find(
      (outra) => outra.finalidade === 'HABILITACAO',
    );
    expect(habilitacao?.faseCodigo).toBe('HABILITACAO');
    expect(habilitacao?.modeloOrigemCodigo).toBe('HAB-PADRAO');
    expect(habilitacao?.conteudo.itens?.map((i) => i.fatoCodigo)).toEqual(['DIPLOMA']);
    expect(
      depois.outrasFinalidades.find((outra) => outra.finalidade === 'ISENCAO_TAXA'),
      'a edição não gravada da outra aba fica',
    ).toBe(editada);
  });

  it('na inscrição, o formulário de onde a cópia trouxe fatos volta ao que o servidor deixou', () => {
    const servidor = {
      formularios: [
        doServidor(FinalidadeFormularioCodigo.INSCRICAO, 'F-INSCRICAO', ['RENDA'], 'INSC'),
        doServidor(FinalidadeFormularioCodigo.ISENCAO_TAXA, 'F-INSCRICAO', ['NIS']),
      ],
      cronogramaFases: FASES,
      regrasDerivacao: [],
    };
    const isencao = {
      finalidade: 'ISENCAO_TAXA',
      faseCodigo: 'INSCRICAO',
      conteudo: com('RENDA', 'NIS'),
    };

    const depois = comAplicacaoDoServidor(
      rascunho({ outrasFinalidades: [isencao] }),
      servidor,
      relato({ fatosTrazidosParaAInscricao: ['RENDA'] }),
      'INSCRICAO',
    );

    expect(depois.conteudo.itens?.map((i) => i.fatoCodigo)).toEqual(['RENDA']);
    expect(depois.modeloOrigemCodigo).toBe('INSC');
    expect(depois.outrasFinalidades[0].conteudo.itens?.map((i) => i.fatoCodigo)).toEqual(['NIS']);
  });

  it('as derivações copiadas do catálogo somam-se às do rascunho, sem trocar as outras', () => {
    const servidor = {
      formularios: [doServidor(FinalidadeFormularioCodigo.INSCRICAO, 'F-INSCRICAO', ['PCD'])],
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
        finalidade: { codigo: FinalidadeFormularioCodigo.ISENCAO_TAXA, rotulo: 'Isenção de taxa' },
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
