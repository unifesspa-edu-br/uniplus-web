import { describe, expect, it } from 'vitest';

import { localDaRecusa } from '../../shared/recusas/local-da-recusa';
import type { ExigenciasDaFase } from '../../shared/descricao-da-fase';
import {
  campoDaRecusaDaFase,
  campoNaTela,
  fimDaFaseNaTela,
  NO_TOPO_DA_FASE,
} from './campo-da-fase';

const campoDe = (field: string) => {
  const local = localDaRecusa(field);
  return local === null ? null : campoDaRecusaDaFase(local);
};

describe('campoDaRecusaDaFase', () => {
  it.each([
    ['fases[0].produtos[1].atoCodigo', 'produtos'],
    ['fases[0].produtos', 'produtos'],
    ['fases[0].emiteParecerIndividual', 'emiteParecerIndividual'],
    ['fases[0].inicio', 'inicio'],
    ['fases[0].fim', 'fim'],
    ['fases[1].unidadeResponsavelId', 'unidadeResponsavelId'],
  ])('leva %s ao campo %s', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it.each([
    'fases[0].bancasRequeridas[2]',
    'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
  ])('reúne sob as bancas requeridas o caminho %s', (field) => {
    expect(campoDe(field)).toBe('bancasRequeridas');
  });

  it.each([
    ['fases[0].regraRecurso.regraCodigo', 'recurso.regra'],
    ['fases[0].regraRecurso.prazoValor', 'recurso.prazoValor'],
    ['fases[0].regraRecurso.prazoUnidade', 'recurso.prazoUnidade'],
    ['fases[0].regraRecurso.atoAncoraCodigo', 'recurso.ancora'],
    ['fases[0].regraRecurso.admiteInstanciaSuperior', 'recurso.admiteInstanciaSuperior'],
    ['fases[0].regraRecurso.efeitoSuspensivo', 'recurso.efeitoSuspensivo'],
    ['fases[0].regraRecurso.guardaDaVaga', 'recurso.guardaDaVaga'],
    ['fases[0].regraRecurso.prazoSegundaInstanciaValor', 'recurso.prazoSegundaInstanciaValor'],
    ['fases[0].regraRecurso.prazoSegundaInstanciaUnidade', 'recurso.prazoSegundaInstanciaUnidade'],
  ])('leva %s ao campo %s da regra de recurso', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it('leva à regra de recurso inteira o campo dela que a tela mostra sem controle', () => {
    expect(campoDe('fases[0].regraRecurso.procedimentosDeRecurso')).toBe('recurso');
    expect(campoDe('fases[0].regraRecurso.procedimentosDeRecurso[1].regra')).toBe('recurso');
    expect(campoDe('fases[0].regraRecurso')).toBe('recurso');
  });

  it.each([
    'fases[0]',
    'fases[0].ordem',
    'fases[0].faseCanonicaId',
    'fases[0].noMesmoMomentoDaAnterior',
    'fases[0].tiposDeDecisao[0]',
  ])('deixa no topo da fase o caminho %s, que a fase conhece sem controle de recusa', (field) => {
    expect(campoDe(field)).toBe(NO_TOPO_DA_FASE);
  });

  it.each([
    'fases[0].bancas[x]',
    'fases[0].codigo',
    'fases[0].campoQueNaoExiste',
    'fases[0].regraRecurso.campoQueNaoExiste',
    'fases[0].regraRecurso.id',
  ])('não dá lugar ao caminho %s: a fase não o conhece e a recusa vai ao resumo', (field) => {
    expect(campoDe(field)).toBeNull();
  });

  it('não aponta campo da fase para a recusa de uma etapa', () => {
    expect(campoDe('etapas[0].produtos')).toBeNull();
  });

  it('lê o campo sem distinguir a caixa que a API usa', () => {
    expect(campoDe('request.Fases[0].UnidadeResponsavelId')).toBe('unidadeResponsavelId');
  });
});

describe('o Fim e o início da fase na tela', () => {
  const exigencias = (parcial: Partial<ExigenciasDaFase>): ExigenciasDaFase => ({
    janelaObrigatoria: false,
    publicaProduto: false,
    admiteRecurso: false,
    fimObrigatorio: false,
    agrupaEtapas: false,
    ...parcial,
  });

  it.each([
    ['período obrigatório', { janelaObrigatoria: true }, false, true],
    ['Fim obrigatório para publicar', { fimObrigatorio: true }, false, true],
    ['Fim já existente ou recusado', {}, true, true],
    ['nenhum motivo', {}, false, false],
  ])('o Fim aparece por %s? %s', (_motivo, parcial, haFimOuRecusa, esperado) => {
    expect(fimDaFaseNaTela(exigencias(parcial), haFimOuRecusa)).toBe(esperado);
  });

  it('o Fim existente ou recusado aparece mesmo quando a tela não sabe o que a fase exige', () => {
    expect(fimDaFaseNaTela(null, true)).toBe(true);
    expect(fimDaFaseNaTela(null, false)).toBe(false);
  });

  it('a recusa ao Fim acha controle mesmo quando a tela não descreve a fase', () => {
    expect(campoNaTela('fim', exigencias({}))).toBe(true);
    expect(campoNaTela('fim', null)).toBe(true);
  });

  it('a unidade só tem controle quando a tela descreve a fase', () => {
    expect(campoNaTela('unidadeResponsavelId', exigencias({}))).toBe(true);
    expect(campoNaTela('unidadeResponsavelId', null)).toBe(false);
  });

  it('o início só aparece com o período obrigatório', () => {
    expect(campoNaTela('inicio', exigencias({ fimObrigatorio: true }))).toBe(false);
    expect(campoNaTela('inicio', exigencias({ janelaObrigatoria: true }))).toBe(true);
  });
});
