import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';
import { beforeEach, describe, expect, it } from 'vitest';
import { OfertasDoCursoComponent } from './ofertas-do-curso.component';
import { oferta } from './cursos.testing';

describe('OfertasDoCursoComponent', () => {
  let fixture: ComponentFixture<OfertasDoCursoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OfertasDoCursoComponent] });
    fixture = TestBed.createComponent(OfertasDoCursoComponent);
  });

  function leituraDe(falha: string | null) {
    return TestBed.runInInjectionContext(() =>
      acompanharLeitura({
        falha: signal(falha),
        pendente: signal(false),
        recarregar: () => undefined,
        destino: () => null,
      }),
    );
  }

  function montar(
    ofertas: readonly OfertaCursoDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      aberto: true,
      titulo: 'Ofertas de ENG-CIV',
      bloqueio: null,
      mensagemDeErro: null,
      carregando: false,
      ofertas,
      temAnterior: false,
      temProximo: false,
      leitura: leituraDe((entradas['mensagemDeErro'] as string | null | undefined) ?? null),
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('mostra programa, regime e turnos da oferta pelos rótulos do domínio', () => {
    montar([{ ...oferta, turnos: ['VESPERTINO', 'MATUTINO'] }]);

    expect(texto()).toContain('IGE — Instituto de Geociências e Engenharias');
    expect(texto()).toContain('Matutino e Vespertino');
  });

  it('mantém o token que o domínio não conhece e mostra traço quando não há turnos', () => {
    montar([
      {
        ...oferta,
        programaDeOferta: 'NOVO_PROGRAMA' as OfertaCursoDto['programaDeOferta'],
        regimeDeTurno: 'NOVO_REGIME' as OfertaCursoDto['regimeDeTurno'],
        turnos: [],
      },
    ]);

    expect(texto()).toContain('NOVO_PROGRAMA');
    expect(texto()).toContain('NOVO_REGIME');
    expect(texto()).toContain('—');
  });

  it('o bloqueio só manda remover ofertas quando elas existem', () => {
    montar([oferta], { bloqueio: 'Remoção bloqueada pela API.' });
    expect(texto()).toContain('Remoção bloqueada pela API.');
    expect(texto()).toContain('Remova as ofertas abaixo');

    montar([], { bloqueio: 'Remoção bloqueada pela API.' });
    expect(texto()).not.toContain('Remova as ofertas abaixo');
  });

  it('a falha da carga mostra o aviso com nova tentativa e não diz que não há ofertas', () => {
    montar([], { mensagemDeErro: 'Falha ao carregar.' });

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('#cfg-ofertas-tentar')).not.toBeNull();
    expect(texto()).toContain('Falha ao carregar.');
    expect(texto()).not.toContain('Nenhuma oferta ativa');
  });

  it('enquanto carrega, mostra o estado de carregamento da lista', () => {
    montar([], { carregando: true });

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.list-state__loading'),
    ).not.toBeNull();
  });
});
