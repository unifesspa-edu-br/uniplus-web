import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { TiposBancaListaComponent } from './tipos-banca-lista.component';

const banca: TipoBancaDto = {
  id: '1',
  codigo: 'BANCA',
  nome: 'Banca',
  faseTipica: null,
  descricao: null,
  criadoEm: '',
};

describe('TiposBancaListaComponent', () => {
  let fixture: ComponentFixture<TiposBancaListaComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposBancaListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TiposBancaListaComponent);
  });
  function montar(bancas: readonly TipoBancaDto[], filtro: boolean): void {
    const entradas: Record<string, unknown> = {
      bancas,
      carregando: false,
      erro: null,
      removendo: true,
      anuncioDaRemocao: 'Removendo a banca.',
      temFiltro: filtro,
      temAnterior: true,
      temProximo: true,
      termoBusca: 'busca',
    };
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }
  it('bloqueia ações das linhas e paginação durante remoção', () => {
    montar([banca], false);
    const raiz = fixture.nativeElement as HTMLElement;
    const botoes = [...raiz.querySelectorAll<HTMLButtonElement>('button')];
    expect(botoes.length).toBeGreaterThanOrEqual(4);
    expect(botoes.filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true')).toEqual(
      [],
    );
    expect(raiz.querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('Removendo a banca.');
  });
  it('mantém as ações focáveis e recusa acionamentos durante a carga', () => {
    montar([banca], false);
    fixture.componentRef.setInput('removendo', false);
    fixture.componentRef.setInput('carregando', true);
    fixture.detectChanges();
    const editados: TipoBancaDto[] = [];
    const removidos: TipoBancaDto[] = [];
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    const raiz = fixture.nativeElement as HTMLElement;
    const editar = raiz.querySelector('button[aria-label^="Editar"]') as HTMLButtonElement;
    const remover = raiz.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement;
    for (const botao of [editar, remover]) {
      expect(botao.disabled).toBe(false);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      botao.focus();
      expect(document.activeElement).toBe(botao);
      botao.click();
    }
    expect(editados).toEqual([]);
    expect(removidos).toEqual([]);
    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
    editar.click();
    remover.click();
    expect(editados).toEqual([banca]);
    expect(removidos).toEqual([banca]);
  });
  it('bloqueia limpar filtros no estado vazio', () => {
    montar([], true);
    const botoes = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ];
    expect(botoes.find((b) => b.textContent?.includes('Limpar filtros'))?.disabled).toBe(true);
    expect(botoes.filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true')).toEqual(
      [],
    );
  });
});
