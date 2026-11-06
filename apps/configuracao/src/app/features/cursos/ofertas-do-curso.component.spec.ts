import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { OfertasDoCursoComponent } from './ofertas-do-curso.component';
import { oferta } from './cursos.testing';

describe('OfertasDoCursoComponent', () => {
  let fixture: ComponentFixture<OfertasDoCursoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OfertasDoCursoComponent] });
    fixture = TestBed.createComponent(OfertasDoCursoComponent);
  });

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

  it('a nova tentativa fica indisponível enquanto carrega, com a classe de estado da lista', () => {
    montar([], { mensagemDeErro: 'Falha ao carregar.', carregando: true });
    const tentar = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.list-state__retry #cfg-ofertas-tentar',
    );
    expect(tentar?.getAttribute('aria-disabled')).toBe('true');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.list-state__loading'),
    ).not.toBeNull();
  });
});
