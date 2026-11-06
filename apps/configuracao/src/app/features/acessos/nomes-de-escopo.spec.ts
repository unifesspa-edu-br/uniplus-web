import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { nomesDeEscopo } from './nomes-de-escopo';
import { ok } from './testes';

describe('nomesDeEscopo', () => {
  function montar() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UnidadesApi,
          useValue: {
            listar: () =>
              of(
                ok([
                  { id: 'u1', nome: 'Centro de Seleção', sigla: 'CEPS' },
                  { id: 'u2', nome: 'Unidade sem sigla', sigla: '' },
                ]),
              ),
          },
        },
      ],
    });
    return runInInjectionContext(TestBed.inject(Injector), () => nomesDeEscopo());
  }

  it('nomeia o escopo pela sigla, pelo nome quando não há sigla, e a instituição', () => {
    const { nome } = montar();

    expect(nome({ unidadeId: 'u1' })).toBe('CEPS');
    expect(nome({ unidadeId: 'u2' })).toBe('Unidade sem sigla');
    expect(nome({ unidadeId: null })).toBe('Instituição');
  });

  it('não inventa nome para uma unidade que o cadastro não traz', () => {
    expect(montar().nome({ unidadeId: 'desconhecida' })).toBe('Unidade não identificada');
  });
});
