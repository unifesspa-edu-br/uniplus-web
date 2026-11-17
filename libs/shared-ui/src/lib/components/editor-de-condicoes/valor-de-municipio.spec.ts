import { HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@uniplus/shared-core/http';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

import { ComboboxComponent, type UiComboboxGroup } from '../combobox/combobox';
import { CondicaoDeFatoComponent } from './condicao-de-fato';
import {
  fatosEscolhiveis,
  type FatoDoCatalogo,
  type FatoEscolhivel,
} from './condicoes/fatos-escolhiveis';
import { type CondicaoDeFato } from './condicoes/valor-da-condicao';
import {
  BUSCA_DE_MUNICIPIOS,
  ESPERA_DA_DIGITACAO_MS,
  NomesDeMunicipios,
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

describe('o campo de município limitado à UF', () => {
  beforeEach(() => ligarRelogioControlado());
  afterEach(() => vi.useRealTimers());

  it('trocar a UF refaz a busca do termo na UF nova', async () => {
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
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    fixture.detectChanges();

    fixture.componentRef.setInput('uf', 'MA');
    fixture.detectChanges();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    fixture.detectChanges();

    expect(busca).toHaveBeenLastCalledWith('Mar', 'MA');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Marabá');
  });
});

describe('o nome do município escolhido', () => {
  const SALVADOR = { codigoIbge: '2927408', nome: 'Salvador', uf: 'BA' };
  const semBusca = () => of({ ok: true as const, data: [] });

  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: semBusca }],
    }),
  );

  function campoCom(rotulosGravados: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(ValorDeMunicipioComponent);
    fixture.componentRef.setInput('rotulo', 'Município de nascimento');
    fixture.componentRef.setInput('values', ['2927408']);
    fixture.componentRef.setInput('rotulosGravados', rotulosGravados);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
  }

  it('é o nome gravado, mesmo que a busca da sessão conheça o código com outro nome', () => {
    TestBed.inject(NomesDeMunicipios).lembrar([{ ...SALVADOR, nome: 'Salvador da Bahia' }]);

    expect(campoCom({ '2927408': 'Salvador (BA)' }).value).toBe('Salvador (BA)');
  });

  it('diz que o nome não foi carregado, com o código, quando nada o dá', () => {
    expect(campoCom().value).toBe('Nome do município não carregado (código IBGE 2927408)');
  });
});

describe('a leitura dos nomes por código', () => {
  const SALVADOR = { codigoIbge: '2927408', nome: 'Salvador', uf: 'BA' };
  const ok = (data: MunicipioEncontrado) => of({ ok: true as const, data });
  const falha = of({ ok: false as const });

  it('lê cada código uma só vez e não lê o que a busca da sessão já trouxe', () => {
    const nomes = TestBed.inject(NomesDeMunicipios);
    nomes.lembrar([MARABA]);
    const ler = vi.fn(() => ok(SALVADOR));

    nomes.carregar(['2927408', '2927408', MARABA.codigoIbge], ler as never);
    nomes.carregar(['2927408'], ler as never);

    expect(ler).toHaveBeenCalledTimes(1);
    expect(ler).toHaveBeenCalledWith('2927408');
    expect(nomes.rotulo('2927408')).toBe('Salvador (BA)');
  });

  it('a leitura pendente não sobrescreve o nome que uma busca gravou enquanto ela corria', () => {
    const nomes = TestBed.inject(NomesDeMunicipios);
    const pendente = new Subject<ApiResult<MunicipioEncontrado>>();

    nomes.carregar(['2927408'], () => pendente);
    nomes.lembrar([{ ...SALVADOR, nome: 'Salvador da Bahia' }]);
    pendente.next({ ok: true as const, data: SALVADOR } as ApiResult<MunicipioEncontrado>);

    expect(nomes.rotulo('2927408')).toBe('Salvador da Bahia (BA)');
  });

  it('com o Geo fora do ar o código segue sem nome e pode ser lido de novo', () => {
    const nomes = TestBed.inject(NomesDeMunicipios);
    const ler = vi.fn().mockReturnValueOnce(falha).mockReturnValueOnce(ok(SALVADOR));

    nomes.carregar(['2927408'], ler as never);
    expect(nomes.rotulo('2927408')).toBe('Nome do município não carregado (código IBGE 2927408)');

    nomes.carregar(['2927408'], ler as never);
    expect(nomes.rotulo('2927408')).toBe('Salvador (BA)');
  });
});

describe('os grupos que o campo de município entrega à lista', () => {
  const SALVADOR: MunicipioEncontrado = { codigoIbge: '2927408', nome: 'Salvador', uf: 'BA' };
  const opcaoDe = (municipio: MunicipioEncontrado, label?: string) => ({
    value: municipio.codigoIbge,
    label: label ?? `${municipio.nome} (${municipio.uf})`,
  });

  interface Cenario {
    readonly escolhidos?: readonly string[];
    readonly achados?: readonly MunicipioEncontrado[];
    /** Municípios que a busca da sessão já trouxe antes, sem que o termo atual os ache. */
    readonly conhecidos?: readonly MunicipioEncontrado[];
    readonly gravados?: Readonly<Record<string, string>>;
  }

  beforeEach(() => ligarRelogioControlado());
  afterEach(() => vi.useRealTimers());

  async function gruposComCenario(cenario: Cenario): Promise<readonly UiComboboxGroup[]> {
    const busca = () => of({ ok: true as const, data: cenario.achados ?? [] });
    TestBed.configureTestingModule({
      providers: [{ provide: BUSCA_DE_MUNICIPIOS, useValue: busca }],
    });
    TestBed.inject(NomesDeMunicipios).lembrar(cenario.conhecidos ?? []);
    const fixture = TestBed.createComponent(ValorDeMunicipioComponent);
    fixture.componentRef.setInput('rotulo', 'Município de residência');
    fixture.componentRef.setInput('values', cenario.escolhidos ?? []);
    fixture.componentRef.setInput('multiplo', (cenario.escolhidos ?? []).length > 1);
    fixture.componentRef.setInput('rotulosGravados', cenario.gravados ?? {});
    fixture.detectChanges();
    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    campo.value = 'Mar';
    campo.dispatchEvent(new Event('input'));
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(ComboboxComponent)).componentInstance.grupos();
  }

  it('um município escolhido forma o grupo "Escolhido" com ele', async () => {
    const grupos = await gruposComCenario({
      escolhidos: [MARABA.codigoIbge],
      conhecidos: [MARABA],
    });

    expect(grupos).toEqual([{ label: 'Escolhido', options: [opcaoDe(MARABA)] }]);
  });

  it('dois ou mais municípios escolhidos formam o grupo "Escolhidos", na ordem recebida', async () => {
    const grupos = await gruposComCenario({
      escolhidos: [SALVADOR.codigoIbge, MARABA.codigoIbge],
      conhecidos: [MARABA, SALVADOR],
    });

    expect(grupos).toEqual([
      { label: 'Escolhidos', options: [opcaoDe(SALVADOR), opcaoDe(MARABA)] },
    ]);
  });

  it('o município escolhido não se repete entre os encontrados', async () => {
    const grupos = await gruposComCenario({
      escolhidos: [MARABA.codigoIbge],
      achados: [MARABA, SALVADOR],
    });

    expect(grupos).toEqual([
      { label: 'Escolhido', options: [opcaoDe(MARABA)] },
      { label: 'Encontrados', options: [opcaoDe(SALVADOR)] },
    ]);
  });

  it('sem escolhido e sem achado não há grupo nenhum', async () => {
    expect(await gruposComCenario({})).toEqual([]);
  });

  it('os achados formam o grupo "Encontrados" mesmo sem escolhido', async () => {
    const grupos = await gruposComCenario({ achados: [MARABA, SALVADOR] });

    expect(grupos).toEqual([
      { label: 'Encontrados', options: [opcaoDe(MARABA), opcaoDe(SALVADOR)] },
    ]);
  });

  it('quando tudo o que a busca achou já está escolhido, não há grupo "Encontrados"', async () => {
    const grupos = await gruposComCenario({ escolhidos: [MARABA.codigoIbge], achados: [MARABA] });

    expect(grupos.map((grupo) => grupo.label)).not.toContain('Encontrados');
  });

  it('o escolhido leva o nome gravado, e o que não tem nome gravado leva o da busca da sessão', async () => {
    const grupos = await gruposComCenario({
      escolhidos: [SALVADOR.codigoIbge, MARABA.codigoIbge],
      conhecidos: [MARABA, SALVADOR],
      gravados: { [SALVADOR.codigoIbge]: 'Salvador da Bahia (BA)' },
    });

    expect(grupos[0].options).toEqual([
      opcaoDe(SALVADOR, 'Salvador da Bahia (BA)'),
      opcaoDe(MARABA),
    ]);
  });
});
