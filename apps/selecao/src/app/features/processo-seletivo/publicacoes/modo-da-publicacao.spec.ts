import { SituacaoDoProdutoPrevisto, type AtoDoProcessoDto, type ProdutoPrevistoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { atoDaCorrecao, escolheOTipo, tituloDa, type ModoDaPublicacao } from './modo-da-publicacao';

const ATO = {
  id: '01960000-0000-7000-0000-0000000005e1',
  tipoCodigo: 'AVISO',
  tipoNome: 'Aviso',
  numero: '01/2026',
} as AtoDoProcessoDto;

const ITEM = {
  id: '01960000-0000-7000-0000-0000000005f1',
  tipoCodigo: 'RESULTADO_HOMOLOGACAO',
  tipoNome: 'Resultado da homologação',
  situacao: SituacaoDoProdutoPrevisto.aberto,
} as ProdutoPrevistoDto;

const POLITICA = { campos: ['Número de inscrição'], justificativa: null };

const AVULSO: ModoDaPublicacao = { tipo: 'avulso' };
const CORRECAO: ModoDaPublicacao = { tipo: 'correcao', ato: ATO };
const PRIMEIRA_DO_ITEM: ModoDaPublicacao = { tipo: 'previsto', item: ITEM, politica: POLITICA, corrigido: null };
const CORRECAO_DO_ITEM: ModoDaPublicacao = { ...PRIMEIRA_DO_ITEM, corrigido: ATO } as ModoDaPublicacao;

describe('modo da publicação', () => {
  it('fixa o ato corrigido na correção de um ato e na correção de um item, e em nenhum outro caso', () => {
    expect(atoDaCorrecao(CORRECAO)).toBe(ATO);
    expect(atoDaCorrecao(CORRECAO_DO_ITEM)).toBe(ATO);
    expect(atoDaCorrecao(PRIMEIRA_DO_ITEM)).toBeNull();
    expect(atoDaCorrecao(AVULSO)).toBeNull();
    expect(atoDaCorrecao(null)).toBeNull();
  });

  it('pede o tipo na tela, salvo no item do edital, que já o traz', () => {
    expect(escolheOTipo(AVULSO)).toBe(true);
    expect(escolheOTipo(CORRECAO)).toBe(true);
    expect(escolheOTipo(PRIMEIRA_DO_ITEM)).toBe(false);
  });

  it('intitula o formulário pelo que ele faz', () => {
    expect(tituloDa(AVULSO)).toBe('Publicar documento');
    expect(tituloDa(CORRECAO)).toBe('Corrigir Aviso nº 01/2026');
    expect(tituloDa(PRIMEIRA_DO_ITEM)).toBe('Publicar Resultado da homologação');
    expect(tituloDa(CORRECAO_DO_ITEM)).toBe('Corrigir Aviso nº 01/2026');
  });
});
