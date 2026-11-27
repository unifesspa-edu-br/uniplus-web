import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { nomesDeEscopo } from './nomes-de-escopo';
import { ok, TIPO_DE_ESCOPO } from './testes';

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

    expect(nome({ unidadeId: 'u1', tipo: TIPO_DE_ESCOPO.UNIDADE })).toBe('CEPS');
    expect(nome({ unidadeId: 'u2', tipo: TIPO_DE_ESCOPO.UNIDADE })).toBe('Unidade sem sigla');
    expect(nome({ unidadeId: null, tipo: TIPO_DE_ESCOPO.INSTITUICAO })).toBe('Instituição');
  });

  it('mostra o rótulo que a API envia para a instituição, sem texto próprio', () => {
    const { nome } = montar();

    expect(nome({ unidadeId: null, tipo: { rotulo: 'Toda a instituição' } })).toBe(
      'Toda a instituição',
    );
  });

  it('nomeia pelo item que traz o tipo em escopoTipo', () => {
    const { nomeDoItem } = montar();

    expect(nomeDoItem({ unidadeId: 'u1', escopoTipo: TIPO_DE_ESCOPO.UNIDADE })).toBe('CEPS');
    expect(nomeDoItem({ unidadeId: null, escopoTipo: TIPO_DE_ESCOPO.INSTITUICAO })).toBe(
      'Instituição',
    );
  });

  it('não inventa nome para uma unidade que o cadastro não traz', () => {
    expect(montar().nome({ unidadeId: 'desconhecida', tipo: TIPO_DE_ESCOPO.UNIDADE })).toBe(
      'Unidade não identificada',
    );
  });
});
