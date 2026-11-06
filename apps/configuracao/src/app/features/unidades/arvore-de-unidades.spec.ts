import { describe, expect, it } from 'vitest';
import { idsDosNosComFilhos, montarArvore } from './arvore-de-unidades';
import { instituto, reitoria } from './unidades.testing';

describe('arvore-de-unidades', () => {
  const filha = { ...instituto, unidadeSuperiorId: reitoria.id };

  it('aninha a filha sob a superior e ordena os irmãos por nome', () => {
    const outra = { ...filha, id: 'o', nome: 'Auditoria' };
    const arvore = montarArvore([filha, outra, reitoria]);

    expect(arvore).toHaveLength(1);
    expect(arvore[0].children.map((no) => no.unidade.nome)).toEqual([
      'Auditoria',
      'Instituto de Ciências Exatas',
    ]);
  });

  it('a unidade cuja superior ficou fora do conjunto vira raiz', () => {
    expect(montarArvore([filha]).map((no) => no.unidade.id)).toEqual([filha.id]);
  });

  it('lista só os nós que têm filhos', () => {
    expect([...idsDosNosComFilhos(montarArvore([filha, reitoria]))]).toEqual([reitoria.id]);
    expect(idsDosNosComFilhos([]).size).toBe(0);
  });
});
