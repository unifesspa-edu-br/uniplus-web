import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { VocabulariosDaComprovacaoApi } from '@uniplus/shared-data/selecao';
import { CatalogoDasConsequenciasDeIndeferimento } from './catalogo-das-consequencias-de-indeferimento.service';

describe('CatalogoDasConsequenciasDeIndeferimento', () => {
  it('informa falha, repete a leitura e conserva a resposta', () => {
    const buscar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(of({ ok: true, data: [{ codigo: 'A', rotulo: 'Rótulo' }] }));
    TestBed.configureTestingModule({
      providers: [
        CatalogoDasConsequenciasDeIndeferimento,
        {
          provide: VocabulariosDaComprovacaoApi,
          useValue: { listarConsequenciasDeIndeferimento: buscar },
        },
      ],
    });
    const catalogo = TestBed.inject(CatalogoDasConsequenciasDeIndeferimento);
    catalogo.carregar();
    expect(catalogo.situacao()).toBe('falhou');
    catalogo.repetir();
    expect(catalogo.situacao()).toBe('pronto');
    expect(catalogo.consequencias()).toEqual([{ codigo: 'A', rotulo: 'Rótulo' }]);
    catalogo.carregar();
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
