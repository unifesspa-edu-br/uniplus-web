import { describe, expect, it } from 'vitest';

import { localDaRecusa } from '../../shared/recusas/local-da-recusa';
import type { ExigenciasDaFase } from '../../shared/descricao-da-fase';
import {
  campoComLinhaNaLista,
  campoDaRecusaDaFase,
  campoNaTela,
  fimDaFaseNaTela,
  marcaDoMesmoMomentoNaTela,
  NO_TOPO_DA_FASE,
  posicaoDaPublicacao,
} from './campo-da-fase';

const campoDe = (field: string) => {
  const local = localDaRecusa(field);
  return local === null ? null : campoDaRecusaDaFase(local);
};

describe('campoDaRecusaDaFase', () => {
  it.each([
    ['fases[0].produtos', 'produtos'],
    ['fases[0].emiteParecerIndividual', 'emiteParecerIndividual'],
    ['fases[0].inicio', 'inicio'],
    ['fases[0].fim', 'fim'],
    ['fases[0].noMesmoMomentoDaAnterior', 'noMesmoMomentoDaAnterior'],
    ['fases[1].unidadeResponsavelId', 'unidadeResponsavelId'],
  ])('leva %s ao campo %s', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it.each([
    ['fases[0].produtos[1].atoCodigo', 'produtos.1.atoCodigo'],
    ['fases[0].produtos[0].papel', 'produtos.0.papel'],
    ['fases[0].produtos[2]', 'produtos.2'],
    ['fases[0].produtos[3].campoQueNaoExiste', 'produtos.3'],
    ['request.Fases[0].Produtos[1].AtoCodigo', 'produtos.1.atoCodigo'],
    ['/cronograma/fases/0/produtos/1/papel', 'produtos.1.papel'],
  ])('leva %s à linha da lista de publicações, no campo %s', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it('dá campos diferentes a linhas diferentes da lista de publicações', () => {
    expect(campoDe('fases[0].produtos[0].atoCodigo')).not.toBe(
      campoDe('fases[0].produtos[1].atoCodigo'),
    );
  });

  it.each([
    'fases[0].bancasRequeridas[2]',
    'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
  ])('reúne sob as bancas requeridas o caminho %s', (field) => {
    expect(campoDe(field)).toBe('bancasRequeridas');
  });

  it.each([
    ['bancasRequeridas.banca-1', 'bancasRequeridas.banca-1'],
    ['bancasRequeridas.banca-1.id', 'bancasRequeridas.banca-1'],
    ['bancasRequeridas.banca-1.regraDeDeliberacao.quorum', 'bancasRequeridas.banca-1.quorum'],
    ['bancasRequeridas.banca-1.regraDeDeliberacao', 'bancasRequeridas.banca-1.regra'],
    [
      'bancasRequeridas.banca-1.categoriasDocumentoIds.0',
      'bancasRequeridas.banca-1.categoriasDocumentoIds',
    ],
    ['bancasRequeridas', 'bancasRequeridas'],
  ])('leva ao controle da banca da tela o caminho %s', (caminho, campo) => {
    expect(campoDaRecusaDaFase({ dono: 'fase', indice: 0, recurso: null, caminho })).toBe(campo);
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

  it.each(['fases[0]', 'fases[0].ordem', 'fases[0].faseCanonicaId', 'fases[0].tiposDeDecisao[0]'])(
    'deixa no topo da fase o caminho %s, que a fase conhece sem controle de recusa',
    (field) => {
      expect(campoDe(field)).toBe(NO_TOPO_DA_FASE);
    },
  );

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

describe('a linha da lista de publicações', () => {
  it.each([
    ['produtos.1.atoCodigo', 1],
    ['produtos.0.papel', 0],
    ['produtos.12', 12],
    ['produtos', null],
    ['fim', null],
    ['recurso.prazoValor', null],
  ])('lê a posição de %s: %s', (campo, posicao) => {
    expect(posicaoDaPublicacao(campo)).toBe(posicao);
  });

  it('deixa a recusa na linha enquanto a posição existe na lista', () => {
    expect(campoComLinhaNaLista('produtos.1.papel', 2)).toBe('produtos.1.papel');
    expect(campoComLinhaNaLista('produtos.1', 2)).toBe('produtos.1');
  });

  it('leva a recusa de uma posição que a lista não tem à lista inteira', () => {
    expect(campoComLinhaNaLista('produtos.2.atoCodigo', 2)).toBe('produtos');
    expect(campoComLinhaNaLista('produtos.0', 0)).toBe('produtos');
  });

  it('não mexe no campo que não é de uma linha', () => {
    expect(campoComLinhaNaLista('fim', 0)).toBe('fim');
    expect(campoComLinhaNaLista('produtos', 0)).toBe('produtos');
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

describe('marca do mesmo momento na tela', () => {
  it.each([
    [0, false, false, false],
    [1, false, false, true],
    [0, true, false, true],
    [0, false, true, true],
  ])('na posição %i, ligada %s e com recusa %s: %s', (posicao, ligada, recusa, esperado) => {
    expect(marcaDoMesmoMomentoNaTela(posicao, ligada, recusa)).toBe(esperado);
  });
});
