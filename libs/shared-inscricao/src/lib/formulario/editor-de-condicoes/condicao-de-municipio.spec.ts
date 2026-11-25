import { HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
import { BUSCA_DE_MUNICIPIOS, ESPERA_DA_DIGITACAO_MS } from '@uniplus/shared-ui/components';
import { CondicaoDeFatoComponent } from './condicao-de-fato';
import {
  fatosEscolhiveis,
  type FatoDoCatalogo,
  type FatoEscolhivel,
} from './condicoes/fatos-escolhiveis';
import { type CondicaoDeFato } from './condicoes/valor-da-condicao';
import { COM_LISTA } from './operadores-de-exemplo.testing';

const MUNICIPIO_DE_RESIDENCIA: FatoDoCatalogo = {
  codigo: 'MUNICIPIO_RESIDENCIA',
  nome: 'Município de residência',
  dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
  valoresDominio: null,
  binding: 'CAMPO_FORMULARIO:MUNICIPIO_RESIDENCIA',
  fonteValores: { codigo: 'MUNICIPIOS', rotulo: 'MUNICIPIOS' },
  operadoresAdmitidos: COM_LISTA,
};

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
    <insc-condicao-de-fato
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
    ligarRelogioControlado();
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

  function digitar(texto: string): void {
    const campo = raiz.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

  it('só busca quando passa a espera da digitação, nem um milissegundo antes', async () => {
    digitar('Mar');

    await passarOTempo(ESPERA_DA_DIGITACAO_MS - 1);
    expect(busca).not.toHaveBeenCalled();

    await passarOTempo(1);
    expect(busca).toHaveBeenCalledWith('Mar');
  });

  it('escolhe o município pela busca e grava o código IBGE dele', async () => {
    digitar('Mar');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
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
