import { describe, expect, it } from 'vitest';

import { conteudo, fato, item, secao } from './conteudos-de-exemplo.testing';
import { acrescentarCampo } from './itens';

describe('campo de município', () => {
  const uf = fato('UF', { dominio: 'CATEGORICO', fonteValores: 'GEO_UF' });
  const municipio = fato('MUNICIPIO', { dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' });

  it('o município nasce restrito à UF respondida antes', () => {
    const comUf = conteudo({
      etapas: [secao('S1', 0)],
      itens: [item('UF', 0, 'S1', { apresentacao: { tipoRenderizacao: 'SELECAO_UNICA' } })],
    });

    const resultado = acrescentarCampo(comUf, municipio, 'S1', { catalogo: [uf, municipio] });

    expect(
      resultado.ok &&
        resultado.conteudo.itens?.find((i) => i.fatoCodigo === 'MUNICIPIO')?.regras.restricoes,
    ).toEqual([{ tipo: 'MUNICIPIOS_DA_UF', fatos: ['UF'] }]);
  });

  it('a UF conhecida antes do formulário — pressuposto ou coletada pela inscrição — também serve ao município', () => {
    const semUf = conteudo({ etapas: [secao('S1', 0)] });

    const resultado = acrescentarCampo(semUf, municipio, 'S1', {
      catalogo: [uf, municipio],
      fatosConhecidosAntes: ['UF'],
    });

    expect(
      resultado.ok &&
        resultado.conteudo.itens?.find((i) => i.fatoCodigo === 'MUNICIPIO')?.regras.restricoes,
    ).toEqual([{ tipo: 'MUNICIPIOS_DA_UF', fatos: ['UF'] }]);
    expect(
      resultado.ok && resultado.conteudo.pressupostos,
      'o fato conhecido antes não entra no conteúdo',
    ).toEqual([]);
  });

  it('sem campo de UF antes, o município é recusado com a orientação', () => {
    const resultado = acrescentarCampo(conteudo({ etapas: [secao('S1', 0)] }), municipio, 'S1', {
      catalogo: [uf, municipio],
    });

    expect(resultado).toEqual({
      ok: false,
      recusa:
        'Acrescente antes o campo de UF: “MUNICIPIO” escolhe entre os municípios da UF respondida antes.',
    });
  });
});
