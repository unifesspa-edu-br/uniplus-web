import { HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MARABA } from './valor-de-municipio.testing';
import {
  BUSCA_DE_MUNICIPIOS,
  ESPERA_DA_DIGITACAO_MS,
  ValorDeMunicipioComponent,
} from './valor-de-municipio';

@Component({
  imports: [ValorDeMunicipioComponent],
  template: `<form (submit)="enviar($event)">
    <ui-valor-de-municipio
      rotulo="Municípios"
      [multiplo]="multiplo"
      [values]="values"
      (valuesChange)="values = $event"
    />
    <button type="submit">Salvar</button>
  </form>`,
})
class FormularioDeMunicipios {
  multiplo = true;
  values: readonly string[] = [];
  enviar = vi.fn((evento: Event) => evento.preventDefault());
}

const falha = { ok: false as const, status: 500, problem: {}, headers: new HttpHeaders() };
const sucesso = { ok: true as const, data: [MARABA] };

describe('Enter no campo de município', () => {
  const busca = vi.fn();
  beforeEach(() => {
    ligarRelogioControlado();
    busca.mockReset().mockReturnValue(of(sucesso));
    TestBed.configureTestingModule({
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: busca }],
    });
  });
  afterEach(() => vi.useRealTimers());

  function montar(multiplo: boolean) {
    const fixture = TestBed.createComponent(FormularioDeMunicipios);
    fixture.componentInstance.multiplo = multiplo;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const elementoDaTela = fixture.nativeElement as HTMLElement;
    const campo = elementoDaTela.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    const salvar = elementoDaTela.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    return { fixture, elementoDaTela, campo, salvar };
  }

  async function buscar(cenario: ReturnType<typeof montar>) {
    cenario.campo.focus();
    cenario.campo.value = 'Mar';
    cenario.campo.dispatchEvent(new Event('input', { bubbles: true }));
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    cenario.fixture.detectChanges();
  }

  function enter(alvo: HTMLElement, acaoPadrao: () => void) {
    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    // O jsdom não executa a ação padrão do Enter.
    if (alvo.dispatchEvent(evento)) acaoPadrao();
    return evento;
  }

  it('impede o envio no modo múltiplo sem opção ativa', () => {
    const c = montar(true);
    const evento = enter(c.campo, () => c.salvar.click());
    expect(evento.defaultPrevented).toBe(true);
    expect(c.fixture.componentInstance.enviar).not.toHaveBeenCalled();
  });

  it.each([{ isComposing: true }, { keyCode: 229 }])(
    'preserva o Enter durante a composição no modo múltiplo: %o',
    (composicao) => {
      const c = montar(true);
      const evento = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        ...composicao,
      });
      c.campo.dispatchEvent(evento);
      expect(evento.defaultPrevented).toBe(false);
    },
  );

  it('seleciona a opção ativa sem enviar no modo múltiplo', async () => {
    const c = montar(true);
    await buscar(c);
    c.campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const evento = enter(c.campo, () => c.salvar.click());
    c.fixture.detectChanges();
    expect(evento.defaultPrevented).toBe(true);
    expect(c.fixture.componentInstance.values).toEqual([MARABA.codigoIbge]);
    expect(c.fixture.componentInstance.enviar).not.toHaveBeenCalled();
  });

  it('permite o envio no modo único', () => {
    const c = montar(false);
    const evento = enter(c.campo, () => c.salvar.click());
    expect(evento.defaultPrevented).toBe(false);
    expect(c.fixture.componentInstance.enviar).toHaveBeenCalledOnce();
  });

  it('permite Enter em Tentar novamente e repete a busca', async () => {
    busca.mockReturnValueOnce(of(falha)).mockReturnValue(of(sucesso));
    const c = montar(true);
    await buscar(c);
    const botao = c.elementoDaTela.querySelector<HTMLButtonElement>(
      'ui-falha-de-leitura-do-campo button',
    ) as HTMLButtonElement;
    const evento = enter(botao, () => botao.click());
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    c.fixture.detectChanges();
    expect(evento.defaultPrevented).toBe(false);
    expect(busca).toHaveBeenCalledTimes(2);
    expect(busca).toHaveBeenLastCalledWith('Mar');
    expect(c.elementoDaTela.querySelector('[role="option"]')?.textContent).toContain('Marabá');
    expect(c.fixture.componentInstance.enviar).not.toHaveBeenCalled();
  });
});
