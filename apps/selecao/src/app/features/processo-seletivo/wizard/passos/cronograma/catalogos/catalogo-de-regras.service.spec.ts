import { TestBed } from '@angular/core/testing';
import { RegrasCatalogoApi, type RegrasCatalogoQuery } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { regraDoCatalogo } from '../procedimentos-do-recurso/procedimentos.testing';
import { CatalogoDeRegras } from './catalogo-de-regras.service';
import { falhaDoServidor, pagina } from './catalogos.testing';

function montar(falhaNoTipo?: string) {
  const listar = vi.fn((query: RegrasCatalogoQuery) =>
    query.tipo === falhaNoTipo
      ? falhaDoServidor()
      : pagina([regraDoCatalogo(`R-${query.tipo}`, 'Base legal de teste')]),
  );
  TestBed.configureTestingModule({
    providers: [CatalogoDeRegras, { provide: RegrasCatalogoApi, useValue: { listar } }],
  });
  const catalogo = TestBed.inject(CatalogoDeRegras);
  catalogo.carregar();
  return { catalogo, listar };
}

describe('CatalogoDeRegras', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega o tipo do procedimento de recurso junto dos demais tipos do cronograma', () => {
    const { catalogo, listar } = montar();

    expect(listar.mock.calls.map(([query]) => query.tipo).sort()).toEqual([
      'REGRA_PRAZO_RECURSO',
      'REGRA_PROCEDIMENTO_RECURSO',
      'algoritmo_contagem_prazo',
      'regra_consolidacao',
    ]);
    expect(catalogo.regrasProcedimento().map((regra) => regra.codigo)).toEqual([
      'R-REGRA_PROCEDIMENTO_RECURSO',
    ]);
    expect(catalogo.regrasRecurso().map((regra) => regra.codigo)).toEqual([
      'R-REGRA_PRAZO_RECURSO',
    ]);
  });

  it('acusa erro e não aplica regra alguma quando o tipo do procedimento falha', () => {
    const { catalogo } = montar('REGRA_PROCEDIMENTO_RECURSO');

    expect(catalogo.erro()).not.toBeNull();
    expect(catalogo.regrasProcedimento()).toEqual([]);
    expect(catalogo.regrasRecurso()).toEqual([]);
  });
});
