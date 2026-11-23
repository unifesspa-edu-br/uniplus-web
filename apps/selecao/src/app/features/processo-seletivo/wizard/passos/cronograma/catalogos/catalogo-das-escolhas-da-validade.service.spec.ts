import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VocabulariosDoPrazoEDaValidadeApi } from '@uniplus/shared-data/selecao';
import { CatalogoDasEscolhasDaValidade } from './catalogo-das-escolhas-da-validade.service';

describe('CatalogoDasEscolhasDaValidade', () => {
  const buscar = vi.fn();
  let catalogo: CatalogoDasEscolhasDaValidade;

  beforeEach(() => {
    buscar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: VocabulariosDoPrazoEDaValidadeApi,
          useValue: { listarEscolhasDaValidade: buscar },
        },
      ],
    });
    catalogo = TestBed.inject(CatalogoDasEscolhasDaValidade);
  });

  it('informa o carregamento e conserva os dados recebidos', () => {
    const resposta = new Subject<{ ok: true; data: { codigo: string; rotulo: string }[] }>();
    buscar.mockReturnValue(resposta);
    catalogo.carregar();
    expect(catalogo.situacao()).toBe('carregando');
    resposta.next({ ok: true, data: [{ codigo: 'A', rotulo: 'Rótulo' }] });
    expect(catalogo.situacao()).toBe('pronto');
    expect(catalogo.escolhasDaValidade()).toEqual([{ codigo: 'A', rotulo: 'Rótulo' }]);
    catalogo.carregar();
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('informa a falha e permite nova tentativa', () => {
    buscar
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(of({ ok: true, data: [] }));
    catalogo.carregar();
    expect(catalogo.situacao()).toBe('falhou');
    expect(catalogo.erro()).not.toBeNull();
    catalogo.repetir();
    expect(catalogo.situacao()).toBe('pronto');
    expect(catalogo.erro()).toBeNull();
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
