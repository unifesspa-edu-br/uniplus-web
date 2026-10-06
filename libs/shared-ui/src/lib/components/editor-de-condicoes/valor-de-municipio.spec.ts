import { HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CondicaoDeFatoComponent } from './condicao-de-fato';
import {
  fatosEscolhiveis,
  type CondicaoDeFato,
  type FatoDoCatalogo,
  type FatoEscolhivel,
} from './condicoes-de-fatos';
import {
  BUSCA_DE_MUNICIPIOS,
  ValorDeMunicipioComponent,
  type MunicipioEncontrado,
} from './valor-de-municipio';

const MUNICIPIO_DE_RESIDENCIA: FatoDoCatalogo = {
  codigo: 'MUNICIPIO_RESIDENCIA',
  nome: 'Município de residência',
  dominio: 'CATEGORICO',
  valoresDominio: null,
  binding: 'CAMPO_FORMULARIO:MUNICIPIO_RESIDENCIA',
  fonteValores: 'GEO_MUNICIPIO',
};

const MARABA: MunicipioEncontrado = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

describe('o fato de município no catálogo do editor', () => {
  it('só é oferecido quando o hospedeiro tem a busca de onde sai o valor', () => {
    expect(fatosEscolhiveis([MUNICIPIO_DE_RESIDENCIA])).toEqual([]);
    expect(fatosEscolhiveis([MUNICIPIO_DE_RESIDENCIA], new Map(), [], true)).toEqual([
      expect.objectContaining({
        codigo: 'MUNICIPIO_RESIDENCIA',
        tipoDominio: 'CATEGORICO_DINAMICO',
        municipio: true,
      }),
    ]);
  });
});

@Component({
  standalone: true,
  imports: [CondicaoDeFatoComponent],
  template: `
    <ui-condicao-de-fato
      idBase="teste"
      [condicao]="condicao()"
      [fatos]="fatos"
      (condicaoChange)="condicao.set($event)"
    />
  `,
})
class HospedeiroDeTeste {
  readonly condicao = signal<CondicaoDeFato>({
    fato: 'MUNICIPIO_RESIDENCIA',
    operador: 'IGUAL',
    valor: '',
  });
  readonly fatos: readonly FatoEscolhivel[] = fatosEscolhiveis(
    [MUNICIPIO_DE_RESIDENCIA],
    new Map(),
    [],
    true,
  );
}

describe('a condição sobre fato de município', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;
  let raiz: HTMLElement;
  const busca = vi.fn((termo: string) =>
    of({
      ok: true as const,
      data: termo === 'Mar' ? [MARABA] : [],
      status: 200,
      headers: new HttpHeaders(),
    }),
  );

  beforeEach(async () => {
    vi.useFakeTimers();
    busca.mockClear();
    await TestBed.configureTestingModule({
      imports: [HospedeiroDeTeste],
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: busca }],
    }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => vi.useRealTimers());

  it('escolhe o município pela busca e grava o código IBGE dele', () => {
    const campo = raiz.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mar';
    campo.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    const opcao = [...raiz.querySelectorAll<HTMLElement>('[role="option"]')].find((item) =>
      item.textContent?.includes('Marabá (PA)'),
    );
    opcao?.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(busca).toHaveBeenCalledWith('Mar');
    expect(fixture.componentInstance.condicao()).toEqual({
      fato: 'MUNICIPIO_RESIDENCIA',
      operador: 'IGUAL',
      valor: '"1504208"',
    });
  });
});

describe('o campo de município limitado à UF', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('trocar a UF refaz a busca do termo na UF nova', () => {
    const busca = vi.fn((_termo: string, uf?: string) =>
      of({ ok: true as const, data: uf === 'PA' ? [MARABA] : [] }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: busca }],
    });
    const fixture = TestBed.createComponent(ValorDeMunicipioComponent);
    fixture.componentRef.setInput('rotulo', 'Município de residência');
    fixture.componentRef.setInput('values', []);
    fixture.componentRef.setInput('uf', 'PA');
    fixture.detectChanges();
    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    campo.value = 'Mar';
    campo.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    fixture.componentRef.setInput('uf', 'MA');
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(busca).toHaveBeenLastCalledWith('Mar', 'MA');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Marabá');
  });
});
