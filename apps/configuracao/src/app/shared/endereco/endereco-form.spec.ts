import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnderecoFormComponent } from './endereco-form';
import { EnderecoEstruturado, camposAncorados, normalizarNivel } from './endereco.model';

const BASE = 'http://localhost:5000';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoFormComponent],
  template: `<cfg-endereco-form [formControl]="ctrl" idPrefix="t" [erroExterno]="erro()" />`,
})
class HostComponent {
  readonly ctrl = new FormControl<EnderecoEstruturado | null>(null);
  readonly erro = signal<string | null>(null);
}

const cepLogradouro = {
  cep: '68507590',
  tipo: 'logradouro',
  logradouro: 'Folha 31, Quadra 7',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: '-5.368',
  longitude: '-49.118',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

function setInput(fixture: ComponentFixture<HostComponent>, id: string, valor: string): void {
  const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

function botaoPorTexto(fixture: ComponentFixture<HostComponent>, texto: string): HTMLButtonElement {
  const botoes = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  ) as HTMLButtonElement[];
  const alvo = botoes.find((b) => b.textContent?.includes(texto));
  if (alvo === undefined) {
    throw new Error(`Botão "${texto}" não encontrado`);
  }
  return alvo;
}

describe('camposAncorados (governança por nivelResolucao — CA-01)', () => {
  it('logradouro ancora cep, logradouro, bairro, distrito e cidade', () => {
    expect([...camposAncorados('logradouro')].sort()).toEqual(
      ['bairro', 'cep', 'cidade', 'distrito', 'logradouro'].sort(),
    );
  });

  it('bairro libera logradouro mas ancora bairro, distrito, cidade e cep', () => {
    const set = camposAncorados('bairro');
    expect(set.has('logradouro')).toBe(false);
    expect(set.has('bairro')).toBe(true);
    expect(set.has('distrito')).toBe(true);
    expect(set.has('cidade')).toBe(true);
    expect(set.has('cep')).toBe(true);
  });

  it('distrito libera logradouro e bairro, ancora distrito/cidade/cep', () => {
    const set = camposAncorados('distrito');
    expect(set.has('logradouro')).toBe(false);
    expect(set.has('bairro')).toBe(false);
    expect(set.has('distrito')).toBe(true);
    expect(set.has('cidade')).toBe(true);
  });

  it('cidade (faixa) ancora apenas cep e cidade', () => {
    expect([...camposAncorados('cidade')].sort()).toEqual(['cep', 'cidade'].sort());
  });

  it('sem resolução (null) não ancora nada', () => {
    expect(camposAncorados(null).size).toBe(0);
  });
});

describe('normalizarNivel', () => {
  it('mantém níveis conhecidos', () => {
    expect(normalizarNivel('bairro')).toBe('bairro');
  });
  it('coage valor desconhecido para o nível mais raso (cidade)', () => {
    expect(normalizarNivel('quadra')).toBe('cidade');
  });
  it('null permanece null', () => {
    expect(normalizarNivel(null)).toBe(null);
  });
});

describe('EnderecoFormComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('CA-01: autofill por CEP preenche o formulário e ancora os campos resolvidos', () => {
    setInput(fixture, 't-cep', '68507-590');
    botaoPorTexto(fixture, 'Buscar CEP').click();

    const req = controller.expectOne(`${BASE}/api/cep/68507590`);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('cep', 1));
    req.flush(cepLogradouro);
    fixture.detectChanges();

    expect(host.ctrl.value).toMatchObject({
      cep: '68507590',
      logradouro: 'Folha 31, Quadra 7',
      bairro: 'Nova Marabá',
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });

    const logradouro = fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement;
    expect(logradouro.readOnly).toBe(true);
    const numero = fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement;
    expect(numero.readOnly).toBe(false);
  });

  it('CA-01: nível bairro deixa logradouro editável e número sempre editável', () => {
    setInput(fixture, 't-cep', '68500000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68500000`).flush({
      ...cepLogradouro,
      cep: '68500000',
      logradouro: null,
      nivelResolucao: 'bairro',
    });
    fixture.detectChanges();

    const logradouro = fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement;
    expect(logradouro.readOnly).toBe(false);
    const bairro = fixture.nativeElement.querySelector('#t-bairro') as HTMLInputElement;
    expect(bairro.readOnly).toBe(true);
  });

  it('CA-06: CEP inexistente (404) exibe erro inline e mantém campos editáveis', () => {
    setInput(fixture, 't-cep', '00000000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    const erro = fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement;
    expect(erro.textContent).toContain('CEP não encontrado');
    const logradouro = fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement;
    expect(logradouro.readOnly).toBe(false);
  });

  it('CA-06: CEP com menos de 8 dígitos não dispara request e avisa o formato', () => {
    setInput(fixture, 't-cep', '123');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    fixture.detectChanges();

    controller.expectNone(`${BASE}/api/cep/123`);
    const erro = fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement;
    expect(erro.textContent).toContain('8 dígitos');
  });

  it('CA-02: fluxo sem CEP seleciona cidade pelo seletor e compõe o valor', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    // Aguarda o debounce real da busca de cidade (ambiente de teste zoneless).
    await new Promise((resolve) => setTimeout(resolve, 350));

    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush([
      { id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' },
    ]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '1504208';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.ctrl.value).toMatchObject({
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      origem: 'manual',
      nivelResolucao: null,
    });
  });

  it('CA-06: erro externo de coerência (422) é exibido inline', () => {
    host.erro.set('CEP incoerente com a cidade informada.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CEP incoerente com a cidade informada.');
  });

  it('writeValue popula campos e mantém âncoras ao editar endereço resolvido', () => {
    host.ctrl.setValue({
      cep: '68507590',
      logradouro: 'Folha 31',
      numero: 's/n',
      complemento: null,
      bairro: 'Nova Marabá',
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });
    fixture.detectChanges();

    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    expect(cep.value).toBe('68507590');
    expect(cep.readOnly).toBe(true);
    const numero = fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement;
    expect(numero.value).toBe('s/n');
    expect(numero.readOnly).toBe(false);
  });
});
