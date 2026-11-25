import { DecidirProtecaoDoCatalogoRequestDecisao } from '@uniplus/shared-data/configuracao';
import { ItemParaSolicitarRequestCadastro } from '@uniplus/shared-data/configuracao';
import { convertToParamMap } from '@angular/router';
import { describe, expect, it } from 'vitest';
import {
  SEM_FILTROS,
  filtrosDaUrl,
  paramsDosFiltros,
  periodoInvalido,
} from './filtros-das-decisoes';

describe('filtros das decisões na URL', () => {
  it('sem parâmetros não há filtro', () => {
    expect(filtrosDaUrl(convertToParamMap({}))).toEqual(SEM_FILTROS);
  });

  it('descarta o que o vocabulário não conhece e ordena as decisões como a tela as oferece', () => {
    const filtros = filtrosDaUrl(
      convertToParamMap({
        ato: [
          DecidirProtecaoDoCatalogoRequestDecisao.DEVOLUCAO,
          'SOLICITACAO',
          DecidirProtecaoDoCatalogoRequestDecisao.APROVACAO,
        ],
        cadastro: 'OUTRO',
        de: '01/10/2026',
        ate: '2026-10-31',
        busca: '  renda ',
        minhas: 'sim',
      }),
    );

    expect(filtros).toEqual({
      ato: [
        DecidirProtecaoDoCatalogoRequestDecisao.APROVACAO,
        DecidirProtecaoDoCatalogoRequestDecisao.DEVOLUCAO,
      ],
      cadastro: null,
      de: '',
      ate: '2026-10-31',
      busca: 'renda',
      minhas: false,
    });
  });

  it('o filtro vazio sai como nulo, para a navegação o tirar da URL', () => {
    expect(paramsDosFiltros(SEM_FILTROS)).toEqual({
      ato: null,
      cadastro: null,
      de: null,
      ate: null,
      busca: null,
      minhas: null,
    });
    expect(
      paramsDosFiltros({
        ...SEM_FILTROS,
        ato: [DecidirProtecaoDoCatalogoRequestDecisao.APROVACAO],
        cadastro: ItemParaSolicitarRequestCadastro.DADO_DO_CANDIDATO,
        minhas: true,
      }),
    ).toMatchObject({
      ato: [DecidirProtecaoDoCatalogoRequestDecisao.APROVACAO],
      cadastro: ItemParaSolicitarRequestCadastro.DADO_DO_CANDIDATO,
      minhas: 'true',
    });
  });

  it('o período com a data final antes da inicial é inválido', () => {
    expect(periodoInvalido({ ...SEM_FILTROS, de: '2026-10-15', ate: '2026-10-01' })).toBe(true);
    expect(periodoInvalido({ ...SEM_FILTROS, de: '2026-10-15', ate: '2026-10-15' })).toBe(false);
    expect(periodoInvalido({ ...SEM_FILTROS, de: '2026-10-15' })).toBe(false);
  });
});
