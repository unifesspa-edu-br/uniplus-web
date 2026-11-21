import { TipoMotivoDeDecisaoCodigo, type MotivoDeDecisaoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { VOCABULARIO_DA_API as VOCABULARIO } from '../decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { agruparPorTipo, tiposEscolhidosNaoDeclarados } from './grupos-de-motivos';
import type { MotivoNoDocumento } from './motivo-no-documento';
import { FASE_DA_INSCRICAO, umMotivoDoCadastro, umMotivoNoDocumento } from './motivos.testing';

const homologacao = umMotivoDoCadastro({ codigo: 'SEM_ENEM', descricao: 'Sem ENEM.' });
const isencao = umMotivoDoCadastro({
  tipo: TipoMotivoDeDecisaoCodigo.ISENCAO_DA_TAXA,
  codigo: 'RENDA_ALTA',
  descricao: 'Renda acima do limite.',
});
const classificacao = umMotivoDoCadastro({
  tipo: TipoMotivoDeDecisaoCodigo.CLASSIFICACAO,
  codigo: 'EMPATE',
});

const agrupar = (
  catalogo: readonly MotivoDeDecisaoDto[],
  escolhidos: readonly MotivoNoDocumento[],
  declarados: readonly string[],
) => agruparPorTipo(catalogo, escolhidos, declarados, VOCABULARIO);
const naoDeclarados = (escolhidos: readonly MotivoNoDocumento[], declarados: readonly string[]) =>
  tiposEscolhidosNaoDeclarados(escolhidos, declarados, VOCABULARIO);

const tipos = (grupos: ReturnType<typeof agruparPorTipo>) => grupos.map((g) => g.tipoCodigo);

describe('agruparPorTipo', () => {
  it('põe os tipos declarados primeiro e os demais na ordem do vocabulário', () => {
    const grupos = agrupar([homologacao, isencao, classificacao], [], ['CLASSIFICACAO']);

    expect(grupos.map((g) => [g.tipoCodigo, g.declarado])).toEqual([
      ['CLASSIFICACAO', true],
      ['ISENCAO_DA_TAXA', false],
      ['HOMOLOGACAO_DAS_INSCRICOES', false],
    ]);
  });

  it('mostra o tipo declarado que não tem motivo no cadastro', () => {
    const grupos = agrupar([isencao], [], ['GABARITO_DA_PROVA']);

    expect(grupos[0]).toMatchObject({ tipoCodigo: 'GABARITO_DA_PROVA', motivos: [] });
  });

  it('dá ao tipo que o vocabulário não conhece o rótulo que o motivo do cadastro traz', () => {
    const doCadastro = umMotivoDoCadastro({ tipo: TipoMotivoDeDecisaoCodigo.HETEROIDENTIFICACAO });

    const [grupo] = agruparPorTipo([doCadastro], [], ['HETEROIDENTIFICACAO'], []);

    expect(grupo).toMatchObject({
      tipoCodigo: 'HETEROIDENTIFICACAO',
      rotulo: 'Heteroidentificação',
    });
  });

  it('esconde o tipo não declarado que não tem motivo', () => {
    expect(tipos(agrupar([isencao], [], []))).toEqual(['ISENCAO_DA_TAXA']);
  });

  it('marca os motivos já escolhidos', () => {
    const escolhido = umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' });

    const [grupo] = agrupar([homologacao], [escolhido], []);

    expect(grupo.motivos.map((m) => [m.codigo, m.escolhido])).toEqual([['SEM_ENEM', true]]);
  });

  it('mantém visível o motivo escolhido de tipo que a fase não declara', () => {
    const escolhido = umMotivoNoDocumento(FASE_DA_INSCRICAO, {
      tipoCodigo: 'ISENCAO_DA_TAXA',
      codigo: 'RENDA_ALTA',
    });

    const grupos = agrupar([isencao], [escolhido], ['CLASSIFICACAO']);

    expect(grupos[1]).toMatchObject({
      tipoCodigo: 'ISENCAO_DA_TAXA',
      declarado: false,
      motivos: [expect.objectContaining({ codigo: 'RENDA_ALTA', escolhido: true })],
    });
  });

  it('não oferece o motivo desativado que ainda não foi escolhido', () => {
    const desativado = umMotivoDoCadastro({ codigo: 'ANTIGO', ativo: false });

    expect(tipos(agrupar([desativado], [], []))).toEqual([]);
  });

  it('mantém o motivo desativado que já estava escolhido, marcado como desativado', () => {
    const desativado = umMotivoDoCadastro({ codigo: 'ANTIGO', ativo: false });
    const escolhido = umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'ANTIGO' });

    const [grupo] = agrupar([desativado], [escolhido], []);

    expect(grupo.motivos).toEqual([
      expect.objectContaining({ codigo: 'ANTIGO', escolhido: true, desativado: true }),
    ]);
  });

  it('usa a cópia do documento para descrever o motivo escolhido', () => {
    const escolhido = umMotivoNoDocumento(FASE_DA_INSCRICAO, {
      codigo: 'SEM_ENEM',
      descricao: 'Cópia guardada.',
    });

    const [grupo] = agrupar([homologacao], [escolhido], []);

    expect(grupo.motivos[0].descricao).toBe('Cópia guardada.');
  });

  it('descreve pelo catálogo o motivo escolhido que veio sem cópia', () => {
    const escolhido = umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' });

    const [grupo] = agrupar([homologacao], [escolhido], []);

    expect(grupo.motivos[0]).toMatchObject({ descricao: 'Sem ENEM.', sentido: 'DESFAVORAVEL' });
  });

  it('mostra o escolhido que o cadastro não traz, com a cópia ou, sem ela, com o código', () => {
    const comCopia = umMotivoNoDocumento(FASE_DA_INSCRICAO, {
      codigo: 'A',
      descricao: 'Cópia de A.',
    });
    const semCopia = umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'B' });

    const [grupo] = agrupar([], [comCopia, semCopia], []);

    expect(grupo.motivos.map((m) => [m.descricao, m.desativado])).toEqual([
      ['Cópia de A.', false],
      ['B', false],
    ]);
  });

  it('não usa o código como rótulo quando nenhum cadastro nomeia o tipo', () => {
    const [grupo] = agruparPorTipo([], [], ['ISENCAO_DA_TAXA'], []);

    expect(grupo.rotulo).toBe('');
  });

  it('põe o código de tipo que o vocabulário não conhece depois dos demais', () => {
    const grupos = agrupar([isencao], [], ['TIPO_NOVO']);

    expect(tipos(grupos)).toEqual(['TIPO_NOVO', 'ISENCAO_DA_TAXA']);
    expect(grupos[0].rotulo).toBe('');
  });
});

describe('tiposEscolhidosNaoDeclarados', () => {
  const emIsencao = umMotivoNoDocumento(FASE_DA_INSCRICAO, {
    tipoCodigo: 'ISENCAO_DA_TAXA',
    codigo: 'A',
  });
  const outroEmIsencao = umMotivoNoDocumento(FASE_DA_INSCRICAO, {
    tipoCodigo: 'ISENCAO_DA_TAXA',
    codigo: 'B',
  });
  const emHomologacao = umMotivoNoDocumento(FASE_DA_INSCRICAO);

  it('lista cada tipo escolhido e não declarado uma vez, na ordem do vocabulário', () => {
    const tipos = naoDeclarados([emHomologacao, emIsencao, outroEmIsencao], []);

    expect(tipos).toEqual(['ISENCAO_DA_TAXA', 'HOMOLOGACAO_DAS_INSCRICOES']);
  });

  it('deixa de fora o tipo que a fase declara', () => {
    const tipos = naoDeclarados([emHomologacao, emIsencao], ['ISENCAO_DA_TAXA']);

    expect(tipos).toEqual(['HOMOLOGACAO_DAS_INSCRICOES']);
  });

  it('não lista nada quando não há motivo escolhido', () => {
    expect(naoDeclarados([], ['CLASSIFICACAO'])).toEqual([]);
  });

  it('inclui o código de tipo que o vocabulário não conhece', () => {
    const desconhecido = umMotivoNoDocumento(FASE_DA_INSCRICAO, { tipoCodigo: 'TIPO_NOVO' });

    expect(naoDeclarados([desconhecido], [])).toEqual(['TIPO_NOVO']);
  });
});
