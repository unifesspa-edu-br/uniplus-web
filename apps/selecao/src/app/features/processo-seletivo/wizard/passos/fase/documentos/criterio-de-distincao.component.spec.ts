import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { CatalogoDosCriteriosDeDistincaoDeApresentacoes } from '../../cronograma/catalogos/catalogo-dos-criterios-de-distincao-de-apresentacoes.service';
import { CriterioDeDistincaoComponent } from './criterio-de-distincao.component';

function montar() {
  const catalogo = {
    criterios: signal([{ codigo: 'MENSAL', rotulo: 'Por mês' }]),
    situacao: signal<'pronto' | 'falhou'>('pronto'),
    erro: signal<string | null>(null),
    carregar: vi.fn(),
    repetir: vi.fn(),
  };
  TestBed.overrideComponent(CriterioDeDistincaoComponent, {
    set: {
      providers: [{ provide: CatalogoDosCriteriosDeDistincaoDeApresentacoes, useValue: catalogo }],
    },
  });
  const fixture = TestBed.createComponent(CriterioDeDistincaoComponent);
  fixture.componentRef.setInput('identificador', 'criterio');
  fixture.detectChanges();
  return { fixture, catalogo };
}

describe('Critério de distinção', () => {
  it('mostra o catálogo e emite o código ou a ausência de distinção', () => {
    const { fixture } = montar();
    const emitir = vi.fn();
    fixture.componentInstance.criterioChange.subscribe(emitir);
    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      'select',
    ) as HTMLSelectElement;
    expect(campo.textContent).toContain('Por mês');
    campo.value = 'MENSAL';
    campo.dispatchEvent(new Event('change'));
    campo.value = '';
    campo.dispatchEvent(new Event('change'));
    expect(emitir.mock.calls).toEqual([['MENSAL'], [null]]);
  });

  it('permite repetir a leitura quando o catálogo falha', () => {
    const { fixture, catalogo } = montar();
    catalogo.erro.set('Não foi possível carregar.');
    catalogo.situacao.set('falhou');
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    expect(tela.querySelector('select')?.disabled).toBe(true);
    tela.querySelector<HTMLButtonElement>('ui-falha-de-leitura-do-campo button')?.click();
    expect(catalogo.repetir).toHaveBeenCalledOnce();
  });
});
