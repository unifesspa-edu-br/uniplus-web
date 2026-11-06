import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PesosEnemEdicaoComponent } from './pesos-enem-edicao.component';
import { criarGrupoDeEdicao } from './pesos-enem-form';
import { AREAS, linhas805 } from './pesos-enem.testing';
import { FormArray } from '@angular/forms';

describe('PesosEnemEdicaoComponent', () => {
  let fixture: ComponentFixture<PesosEnemEdicaoComponent>;
  const emitidos: string[] = [];

  beforeEach(() => {
    emitidos.length = 0;
    TestBed.configureTestingModule({ imports: [PesosEnemEdicaoComponent] });
    fixture = TestBed.createComponent(PesosEnemEdicaoComponent);
    fixture.componentInstance.salvar.subscribe(() => emitidos.push('salvar'));
    fixture.componentInstance.cancelar.subscribe(() => emitidos.push('cancelar'));
  });
  afterEach(() => TestBed.resetTestingModule());

  function montar(entradas: Record<string, unknown> = {}): void {
    const padrao = {
      resolucao: 'Res. 805/2024',
      areas: AREAS,
      form: new FormArray(linhas805.map((linha) => criarGrupoDeEdicao(linha, AREAS))),
      estadoLinhas: new Map(),
      erro: null,
      gravando: false,
      salvando: false,
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botao = (texto: string): HTMLButtonElement =>
    [...raiz().querySelectorAll('button')].find((b) =>
      b.textContent?.includes(texto),
    ) as HTMLButtonElement;

  it('com escrita em curso, Cancelar fica desabilitado e Salvar indisponível sem emitir', () => {
    montar({ gravando: true, salvando: true });

    expect(botao('Cancelar').matches(':disabled')).toBe(true);
    expect(botao('Salvando...').getAttribute('aria-disabled')).toBe('true');
    expect(botao('Salvando...').getAttribute('aria-busy')).toBe('true');
    botao('Salvando...').click();
    expect(emitidos).toEqual([]);
  });

  it('durante a recarga que segue outra escrita, Salvar fica indisponível mas não se apresenta como salvando', () => {
    montar({ gravando: true, salvando: false });

    expect(botao('Salvar').getAttribute('aria-disabled')).toBe('true');
    expect(botao('Salvar').getAttribute('aria-busy')).toBeNull();
    expect(raiz().querySelector('fieldset')?.disabled).toBe(false);
    botao('Salvar').click();
    expect(emitidos).toEqual([]);
  });

  it('o fieldset da grade só fica desabilitado enquanto envia', () => {
    montar({ salvando: true, gravando: true });
    expect(raiz().querySelector('fieldset')?.disabled).toBe(true);
    for (const campo of raiz().querySelectorAll('input')) {
      expect(campo.matches(':disabled')).toBe(true);
    }
  });

  it('sem escrita em curso, Salvar emite e o Esc na grade pede o cancelamento', () => {
    montar();

    botao('Salvar').click();
    raiz().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitidos).toEqual(['salvar', 'cancelar']);
  });
});
