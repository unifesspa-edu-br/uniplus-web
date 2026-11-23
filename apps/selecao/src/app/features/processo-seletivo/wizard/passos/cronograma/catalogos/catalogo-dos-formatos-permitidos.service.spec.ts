import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { VocabulariosDaComprovacaoApi } from '@uniplus/shared-data/selecao';
import { CatalogoDosFormatosPermitidos } from './catalogo-dos-formatos-permitidos.service';

describe('CatalogoDosFormatosPermitidos', () => {
  it('informa falha, repete a leitura e conserva a resposta', () => {
    const buscar = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(of({ ok: true, data: [{ codigo: 'A', rotulo: 'Rótulo' }] }));
    TestBed.configureTestingModule({
      providers: [
        CatalogoDosFormatosPermitidos,
        { provide: VocabulariosDaComprovacaoApi, useValue: { listarFormatosPermitidos: buscar } },
      ],
    });
    const catalogo = TestBed.inject(CatalogoDosFormatosPermitidos);
    catalogo.carregar();
    expect(catalogo.situacao()).toBe('falhou');
    catalogo.repetir();
    expect(catalogo.situacao()).toBe('pronto');
    expect(catalogo.formatos()).toEqual([{ codigo: 'A', rotulo: 'Rótulo' }]);
    catalogo.carregar();
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
