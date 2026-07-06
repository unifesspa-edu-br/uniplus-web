import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnderecoFormComponent } from './endereco-form';
import {
  EnderecoEstruturado,
  camposAncorados,
  ehErroDeEndereco,
  enderecoEstruturadoDe,
  enderecoParaCommand,
  normalizarNivel,
} from './endereco.model';

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

describe('enderecoParaCommand (mapeamento para o command — CA-04)', () => {
  it('com CEP de 8 dígitos envia cidade top-level + endereco aninhado', () => {
    const part = enderecoParaCommand({
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
    expect(part.cidadeCodigoIbge).toBe('1504208');
    expect(part.endereco).not.toBeNull();
    expect(part.endereco?.cep).toBe('68507590');
    expect(part.endereco?.nivelResolucao).toBe('logradouro');
  });

  it('sem CEP envia só a cidade top-level e endereco nulo (fluxo sem CEP)', () => {
    const part = enderecoParaCommand({
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      distrito: null,
      cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      latitude: null,
      longitude: null,
      nivelResolucao: null,
      origem: 'manual',
    });
    expect(part.cidadeCodigoIbge).toBe('1504208');
    expect(part.endereco).toBeNull();
  });

  it('valor nulo zera cidade e endereco', () => {
    expect(enderecoParaCommand(null)).toEqual({
      cidadeCodigoIbge: null,
      cidadeNome: null,
      cidadeUf: null,
      endereco: null,
    });
  });
});

describe('enderecoEstruturadoDe (DTO → componente)', () => {
  it('endereco aninhado vira valor do componente coagindo lat/long numéricos', () => {
    const valor = enderecoEstruturadoDe(
      { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
      {
        cep: '68507590',
        logradouro: 'Folha 31',
        numero: 's/n',
        complemento: null,
        bairro: 'Nova Marabá',
        distrito: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        latitude: -5.368,
        longitude: -49.118,
        nivelResolucao: 'logradouro',
        origem: 'geo-api',
      },
    );
    expect(valor?.cidade?.codigoIbge).toBe('1504208');
    expect(valor?.latitude).toBe('-5.368');
  });

  it('cidade sem endereço estruturado vira modo manual', () => {
    const valor = enderecoEstruturadoDe({ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }, null);
    expect(valor?.origem).toBe('manual');
    expect(valor?.cep).toBeNull();
  });

  it('sem cidade nem endereço devolve null', () => {
    expect(enderecoEstruturadoDe(null, null)).toBeNull();
  });
});

describe('ehErroDeEndereco (casamento por segmento, não substring)', () => {
  it('reconhece campos/códigos do endereço e cidade', () => {
    expect(ehErroDeEndereco('Endereco.Cep')).toBe(true);
    expect(ehErroDeEndereco('CidadeCodigoIbge')).toBe(true);
    expect(ehErroDeEndereco('uniplus.configuracao.endereco_referencia.cep_formato_invalido')).toBe(true);
  });

  it('não classifica errado chaves que apenas contêm o trecho', () => {
    expect(ehErroDeEndereco('Concepcao')).toBe(false);
    expect(ehErroDeEndereco('Mantenedora')).toBe(false);
    expect(ehErroDeEndereco('Sigla')).toBe(false);
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

  it('CA-01: "Trocar CEP" destrava o campo sem descartar o restante do endereço resolvido — #438', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();

    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    expect(cep.readOnly).toBe(true);
    expect(() => botaoPorTexto(fixture, 'Buscar CEP')).toThrow();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();

    expect(cep.readOnly).toBe(false);
    expect(cep.value).toBe('68507590');
    expect(() => botaoPorTexto(fixture, 'Trocar CEP')).toThrow();
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Folha 31, Quadra 7',
    );
    expect(host.ctrl.value).toMatchObject({ logradouro: 'Folha 31, Quadra 7' });
  });

  it('CA-01: corrige o CEP após "Trocar CEP" e re-ancora com o novo endereço resolvido — #438', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();

    setInput(fixture, 't-cep', '68500000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68500000`).flush({
      ...cepLogradouro,
      cep: '68500000',
      logradouro: null,
      bairro: 'Novo Bairro',
      nivelResolucao: 'bairro',
    });
    fixture.detectChanges();

    expect(host.ctrl.value).toMatchObject({
      cep: '68500000',
      bairro: 'Novo Bairro',
      nivelResolucao: 'bairro',
    });
    const cep = fixture.nativeElement.querySelector('#t-cep') as HTMLInputElement;
    expect(cep.readOnly).toBe(true);
    expect(() => botaoPorTexto(fixture, 'Trocar CEP')).not.toThrow();
    expect(() => botaoPorTexto(fixture, 'Buscar CEP')).toThrow();
  });

  it('CA-01: falha ao corrigir CEP preserva a última resolução válida em vez de descartá-la — #438', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();

    setInput(fixture, 't-cep', '00000000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    // A resolução anterior não é descartada por uma tentativa de correção que falhou.
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement)?.value).toBe(
      'Folha 31, Quadra 7',
    );
    expect((fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement).textContent).toContain(
      'CEP não encontrado',
    );

    // Voltar ao CEP original (sem nova busca) reaprova o formulário e limpa o erro obsoleto.
    setInput(fixture, 't-cep', '68507590');
    fixture.detectChanges();

    expect(host.ctrl.valid).toBe(true);
    expect(host.ctrl.value).toMatchObject({
      cep: '68507590',
      logradouro: 'Folha 31, Quadra 7',
      nivelResolucao: 'logradouro',
    });
    expect(fixture.nativeElement.querySelector('#t-cep-error')).toBeNull();
  });

  it('CA-01: esvaziar o CEP durante a correção descarta a resolução preservada — #438', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();

    setInput(fixture, 't-cep', '');
    fixture.detectChanges();

    // Nada fica visível mas fora do que seria submetido: os campos de detalhe
    // (derivados da resolução anterior) somem junto com o CEP, não continuam
    // na tela para um valor que não seria mais enviado.
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Marabá');
    expect(host.ctrl.valid).toBe(true);
    expect(host.ctrl.value).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).cidadeCodigoIbge).toBeNull();
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

  it('CA-06: CEP inexistente (404) exibe erro inline e não exibe campos de endereço', () => {
    setInput(fixture, 't-cep', '00000000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    const erro = fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement;
    expect(erro.textContent).toContain('CEP não encontrado');
    // Sem CEP resolvido, os campos de endereço ficam ocultos (não persistiriam).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
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

  it('após 404, entrar no modo manual limpa o CEP (não vaza endereço inválido) — #412', async () => {
    setInput(fixture, 't-cep', '00000000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush([
      { id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' },
    ]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '1504208';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.ctrl.value?.cep).toBeNull();
    // O mapeamento para o command não deve montar `endereco` (só cidade).
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).cidadeCodigoIbge).toBe('1504208');
  });

  it('CEP que falha (404) durante o modo manual não vira endereço — #412', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush([
      { id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' },
    ]);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '1504208';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    setInput(fixture, 't-cep', '00000000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/00000000`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    expect(host.ctrl.value?.cep).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();
    expect(host.ctrl.value?.cidade?.codigoIbge).toBe('1504208');
  });

  it('S1: falha na busca de cidades sinaliza erro e permite retry', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush(null, {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar as cidades');

    botaoPorTexto(fixture, 'Tentar novamente').click();
    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush([
      { id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Não foi possível carregar as cidades');
  });

  it('trocar para "sem CEP" após resolver limpa e oculta os campos de endereço — #412', async () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Folha 31, Quadra 7',
    );

    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();

    // Campos de endereço ocultos e limpos no fluxo sem CEP (não são descartados em silêncio).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
    expect(host.ctrl.value?.logradouro ?? null).toBeNull();
    expect(host.ctrl.value?.cep).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();

    // Drena a busca de cidades disparada pelo modo manual.
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush([]);
  });

  it('ignora resposta obsoleta de CEP quando o campo já mudou — #412', () => {
    setInput(fixture, 't-cep', '11111111');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    // Usuário altera o CEP enquanto o lookup do 11111111 está em voo.
    setInput(fixture, 't-cep', '22222222');
    controller.expectOne(`${BASE}/api/cep/11111111`).flush(cepLogradouro);
    fixture.detectChanges();

    // A resposta obsoleta (de 11111111) não pode popular o formulário do 22222222:
    // sem resolução aplicada, não há cidade nem campos de endereço exibidos.
    expect(host.ctrl.value?.cidade ?? null).toBeNull();
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
  });

  it('autofill preenche o complemento vindo do Geo — #412', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller
      .expectOne(`${BASE}/api/cep/68507590`)
      .flush({ ...cepLogradouro, complemento: 'Bloco A' });
    fixture.detectChanges();
    expect(host.ctrl.value?.complemento).toBe('Bloco A');
  });

  it('bloqueia o save enquanto o CEP digitado não é resolvido (Validator) — #412', () => {
    setInput(fixture, 't-cep', '12345678');
    fixture.detectChanges();

    expect(host.ctrl.invalid).toBe(true);
    expect(host.ctrl.errors).toEqual({ cepNaoResolvido: true });
    expect(host.ctrl.value?.cep ?? null).toBeNull();

    // Limpar o CEP volta a validar (endereço opcional pode salvar sem CEP).
    setInput(fixture, 't-cep', '');
    fixture.detectChanges();
    expect(host.ctrl.valid).toBe(true);
  });

  it('marca CEP sem dígitos (ex.: "abc") como pendente/inválido — #412', () => {
    setInput(fixture, 't-cep', 'abc');
    fixture.detectChanges();
    expect(host.ctrl.invalid).toBe(true);
    expect(host.ctrl.errors).toEqual({ cepNaoResolvido: true });
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
