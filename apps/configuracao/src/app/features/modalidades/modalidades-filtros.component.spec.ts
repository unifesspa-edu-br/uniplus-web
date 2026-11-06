import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModalidadesFiltrosComponent } from './modalidades-filtros.component';

describe('ModalidadesFiltrosComponent', () => {
  let fixture: ComponentFixture<ModalidadesFiltrosComponent>;
  let raiz: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ModalidadesFiltrosComponent] });
    fixture = TestBed.createComponent(ModalidadesFiltrosComponent);
    raiz = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('busca', '');
    fixture.componentRef.setInput('naturezaSelecionada', null);
    fixture.componentRef.setInput('filtrosAtivos', []);
    fixture.componentRef.setInput('chipsNatureza', [{ value: 'AMPLA', label: 'Ampla', count: 1 }]);
  });

  const limpar = (): HTMLButtonElement | undefined =>
    [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Limpar'),
    );

  it('com remoção em curso, "Limpar" fica desabilitado e não pede a limpeza', () => {
    fixture.componentRef.setInput('removendo', true);
    fixture.detectChanges();
    const pedidos: number[] = [];
    fixture.componentInstance.limpar.subscribe(() => pedidos.push(1));

    limpar()?.click();

    expect(limpar()?.disabled).toBe(true);
    expect(pedidos).toEqual([]);
  });

  it('sem remoção, "Limpar" pede a limpeza dos filtros', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();
    const pedidos: number[] = [];
    fixture.componentInstance.limpar.subscribe(() => pedidos.push(1));

    limpar()?.click();

    expect(pedidos).toEqual([1]);
  });
});
