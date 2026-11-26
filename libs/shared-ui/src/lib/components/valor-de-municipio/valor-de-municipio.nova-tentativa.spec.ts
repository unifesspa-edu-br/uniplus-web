import { HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

import { MARABA, montarCampoDeMunicipio } from './valor-de-municipio.testing';
import {
  BUSCA_DE_MUNICIPIOS,
  ESPERA_DA_DIGITACAO_MS,
  ValorDeMunicipioComponent,
} from './valor-de-municipio';

const falha = { ok: false as const, status: 500, problem: {}, headers: new HttpHeaders() };
const sucesso = { ok: true as const, data: [MARABA] };

@Component({
  imports: [ValorDeMunicipioComponent],
  template: `
    <ui-valor-de-municipio rotulo="Município" [values]="[]" uf="PA" />
    <ui-valor-de-municipio rotulo="Outro município" [values]="[]" />
  `,
})
class DoisCamposDeMunicipio {}

describe.each([false, true])('nova tentativa de município (múltiplo: %s)', (multiplo) => {
  const busca = vi.fn();

  beforeEach(() => {
    ligarRelogioControlado();
    busca.mockReset().mockReturnValueOnce(of(falha)).mockReturnValue(of(sucesso));
    TestBed.configureTestingModule({
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: busca }],
    });
  });
  afterEach(() => vi.useRealTimers());

  async function digitar(cenario: ReturnType<typeof montarCampoDeMunicipio>, termo: string) {
    cenario.campo.value = termo;
    cenario.campo.dispatchEvent(new Event('input'));
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    cenario.fixture.detectChanges();
  }

  it('mostra uma única mensagem de falha e oferece nova tentativa', async () => {
    const cenario = montarCampoDeMunicipio(multiplo);
    await digitar(cenario, 'Mar');
    const alerta = cenario.raiz.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Não foi possível buscar os municípios');
    expect(cenario.raiz.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(
      cenario.raiz.querySelector('ui-falha-de-leitura-do-campo button')?.textContent,
    ).toContain('Tentar novamente');
    expect(cenario.raiz.querySelector('[role="status"]')?.textContent).not.toContain(
      'Não foi possível',
    );
  });

  it('associa o aviso ao campo junto às descrições do consumidor apenas enquanto visível', async () => {
    const cenario = montarCampoDeMunicipio(multiplo);
    cenario.fixture.componentRef.setInput('descritoPor', 'ajuda erro-consumidor ajuda');
    cenario.fixture.detectChanges();
    const ids = () => cenario.campo.getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    expect(cenario.raiz.querySelector('ui-falha-de-leitura-do-campo .field__error')).toBeNull();
    expect(ids()).toContain('ajuda');
    expect(ids()).toContain('erro-consumidor');
    expect(ids().filter((id) => id.startsWith('ui-falha-de-leitura-do-campo-'))).toHaveLength(0);

    await digitar(cenario, 'Mar');
    const aviso = cenario.raiz.querySelector<HTMLElement>(
      'ui-falha-de-leitura-do-campo .field__error',
    );
    expect(aviso?.id).toBeTruthy();
    expect(aviso?.textContent).toContain('Tentar novamente');
    expect(ids()).toContain(aviso?.id);
    expect(ids()).toContain('ajuda');
    expect(ids()).toContain('erro-consumidor');
    expect(ids().filter((id) => id === 'ajuda')).toHaveLength(1);
    expect(cenario.raiz.querySelector(`#${aviso?.id}`)).toBe(aviso);

    (aviso?.querySelector('button') as HTMLButtonElement).click();
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    cenario.fixture.detectChanges();
    expect(ids()).not.toContain(aviso?.id);
    expect(cenario.raiz.querySelector(`#${aviso?.id}`)).toBeNull();
    expect(ids()).toContain('ajuda');
  });

  it('mantém o termo e as opções ao tentar novamente pelo teclado', async () => {
    const cenario = montarCampoDeMunicipio(multiplo);
    cenario.campo.focus();
    await digitar(cenario, 'Mar');
    const botao = cenario.raiz.querySelector(
      'ui-falha-de-leitura-do-campo button',
    ) as HTMLButtonElement;
    cenario.campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    cenario.fixture.detectChanges();
    expect(cenario.campo.getAttribute('aria-expanded')).toBe('false');
    // O jsdom não executa as ações padrão de Tab e Enter.
    botao.focus();
    expect(document.activeElement).toBe(botao);
    botao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    botao.click();
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    cenario.fixture.detectChanges();
    expect(busca).toHaveBeenCalledTimes(2);
    expect(busca).toHaveBeenLastCalledWith('Mar', 'PA');
    expect(document.activeElement).toBe(cenario.campo);
    expect(cenario.campo.value).toBe('Mar');
    expect(cenario.campo.getAttribute('aria-expanded')).toBe('true');
    expect(cenario.raiz.querySelector('[role="option"]')?.textContent).toContain('Marabá (PA)');
  });

  it('mantém as opções abertas após nova tentativa com o mouse', async () => {
    const cenario = montarCampoDeMunicipio(multiplo);
    cenario.campo.focus();
    await digitar(cenario, 'Mar');
    const botao = cenario.raiz.querySelector(
      'ui-falha-de-leitura-do-campo button',
    ) as HTMLButtonElement;
    botao.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    botao.focus();
    expect(document.activeElement).toBe(botao);
    botao.click();
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    cenario.fixture.detectChanges();
    expect(document.activeElement).toBe(cenario.campo);
    expect(cenario.campo.value).toBe('Mar');
    expect(cenario.campo.getAttribute('aria-expanded')).toBe('true');
    expect(cenario.raiz.querySelector('[role="option"]')?.textContent).toContain('Marabá (PA)');
  });

  it('fecha outro combobox ao clicar na nova tentativa', async () => {
    const fixture = TestBed.createComponent(DoisCamposDeMunicipio);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const [campo, outro] = raiz.querySelectorAll<HTMLInputElement>('input[role="combobox"]');
    campo.focus();
    campo.value = 'Mar';
    campo.dispatchEvent(new Event('input'));
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    fixture.detectChanges();
    outro.focus();
    fixture.detectChanges();
    expect(outro.getAttribute('aria-expanded')).toBe('true');

    const botao = raiz.querySelector('ui-falha-de-leitura-do-campo button') as HTMLButtonElement;
    botao.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(outro.getAttribute('aria-expanded')).toBe('false');
  });

  it('só busca a partir de três letras', async () => {
    const cenario = montarCampoDeMunicipio(multiplo);
    await digitar(cenario, 'Ma');
    expect(busca).not.toHaveBeenCalled();
    await digitar(cenario, 'Mar');
    expect(busca).toHaveBeenCalledWith('Mar', 'PA');
  });
});
