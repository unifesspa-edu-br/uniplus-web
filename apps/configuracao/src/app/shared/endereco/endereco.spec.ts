import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EnderecoGeoComponent,
  camposAncorados,
  normalizarNivel,
  type EnderecoEstruturado,
} from '@uniplus/shared-ui/components';
import { ehErroDeEndereco, enderecoEstruturadoDe, enderecoParaCommand } from './endereco.model';
import { ENDERECO_NO_GEO } from './provedores-do-geo';

const BASE = 'http://localhost:5000';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  providers: [ENDERECO_NO_GEO],
  template: `<ui-endereco-geo [formControl]="ctrl" idPrefix="t" [erroExterno]="erro()" />`,
})
class HostComponent {
  readonly ctrl = new FormControl<EnderecoEstruturado | null>(null);
  readonly erro = signal<string | null>(null);
}

const cepLogradouro = {
  cep: '68507590',
  tipo: 'Rua',
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

/** Escolhe a UF do endereço sem CEP. */
function escolherUf(fixture: ComponentFixture<HostComponent>, sigla: string): void {
  const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLSelectElement;
  uf.value = sigla;
  uf.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

/** Escolhe a UF e busca a cidade no campo de município, escolhendo a opção achada pelo Geo. */
async function escolherCidade(
  fixture: ComponentFixture<HostComponent>,
  controller: HttpTestingController,
): Promise<void> {
  escolherUf(fixture, 'PA');
  const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
  campo.value = 'Mara';
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  // Aguarda a espera da digitação da busca (ambiente de teste zoneless).
  await new Promise((resolve) => setTimeout(resolve, 350));
  const busca = controller.expectOne((r) => r.url === `${BASE}/api/cidades`);
  expect(busca.request.params.get('q')).toBe('Mara');
  expect(busca.request.params.get('uf')).toBe('PA');
  busca.flush([{ id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
  fixture.detectChanges();
  const opcao = Array.from(
    fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>,
  ).find((item) => item.textContent?.includes('Marabá (PA)'));
  if (opcao === undefined) {
    throw new Error('A cidade buscada não apareceu entre as opções');
  }
  opcao.dispatchEvent(new MouseEvent('mousedown'));
  fixture.detectChanges();
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

describe('EnderecoGeoComponent com o Geo', () => {
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
      logradouro: 'Rua Folha 31, Quadra 7',
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
      'Rua Folha 31, Quadra 7',
    );
    expect(host.ctrl.value).toMatchObject({ logradouro: 'Rua Folha 31, Quadra 7' });
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
      'Rua Folha 31, Quadra 7',
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
      logradouro: 'Rua Folha 31, Quadra 7',
      nivelResolucao: 'logradouro',
    });
    expect(fixture.nativeElement.querySelector('#t-cep-error')).toBeNull();
  });

  it('CA-01: esvaziar o CEP durante a correção descarta a resolução preservada — #438', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();
    setInput(fixture, 't-numero', '123');
    fixture.detectChanges();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();

    setInput(fixture, 't-cep', '');
    fixture.detectChanges();

    // Nada fica visível mas fora do que seria submetido: os campos de detalhe
    // (derivados da resolução anterior) somem junto com o CEP, não continuam
    // na tela para um valor que não seria mais enviado. numero também é
    // limpo — do contrário, vazaria para o próximo CEP resolvido (endereço
    // potencialmente diferente).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Marabá');
    expect(host.ctrl.valid).toBe(true);
    expect(host.ctrl.value).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).cidadeCodigoIbge).toBeNull();

    // Resolver um novo CEP não ressuscita o número do endereço abandonado.
    setInput(fixture, 't-cep', '68500000');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68500000`).flush({
      ...cepLogradouro,
      cep: '68500000',
      bairro: 'Novo Bairro',
      nivelResolucao: 'bairro',
    });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#t-numero') as HTMLInputElement).value).toBe('');
  });

  it('CA-01: abandonar a correção (esvaziar CEP após falha) limpa o erro obsoleto — #438', () => {
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
    expect((fixture.nativeElement.querySelector('#t-cep-error') as HTMLElement).textContent).toContain(
      'CEP não encontrado',
    );

    // Desiste da correção esvaziando o campo por completo — endereço vazio é
    // válido (opcional), então o erro da tentativa anterior não pode persistir.
    setInput(fixture, 't-cep', '');
    fixture.detectChanges();

    expect(host.ctrl.valid).toBe(true);
    expect(fixture.nativeElement.querySelector('#t-cep-error')).toBeNull();
  });

  it('CA-01: texto sem dígitos (ex.: "abc") durante a correção não descarta a resolução preservada — #438', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();

    // "abc" não tem dígitos, mas o campo não está vazio — é formato pendente
    // (CA-06), não abandono da correção. A resolução preservada continua ali.
    setInput(fixture, 't-cep', 'abc');
    fixture.detectChanges();

    expect(host.ctrl.invalid).toBe(true);
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement)?.value).toBe(
      'Rua Folha 31, Quadra 7',
    );

    // Corrigir para o CEP original (sem nova busca) reaprova o formulário.
    setInput(fixture, 't-cep', '68507590');
    fixture.detectChanges();
    expect(host.ctrl.valid).toBe(true);
    expect(host.ctrl.value).toMatchObject({ cep: '68507590', nivelResolucao: 'logradouro' });
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

  it('CA-01: concatena tipo e logradouro do Geo ao aplicar CEP resolvido — #439', () => {
    setInput(fixture, 't-cep', '71720022');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/71720022`).flush({
      ...cepLogradouro,
      cep: '71720022',
      tipo: 'Terceira',
      logradouro: 'Avenida Bloco 1740',
    });
    fixture.detectChanges();

    expect(host.ctrl.value).toMatchObject({ logradouro: 'Terceira Avenida Bloco 1740' });
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Terceira Avenida Bloco 1740',
    );
  });

  it('CA-01: reproduz o segundo caso relatado na issue (Rua "8") — #439', () => {
    setInput(fixture, 't-cep', '68508714');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68508714`).flush({
      ...cepLogradouro,
      cep: '68508714',
      tipo: 'Rua',
      logradouro: '8',
    });
    fixture.detectChanges();

    expect(host.ctrl.value).toMatchObject({ logradouro: 'Rua 8' });
  });

  it('CA-01: tipo nulo mantém apenas o logradouro, sem prefixo — #439', () => {
    setInput(fixture, 't-cep', '68500123');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68500123`).flush({
      ...cepLogradouro,
      cep: '68500123',
      tipo: null,
      logradouro: 'Travessa Sem Tipo',
    });
    fixture.detectChanges();

    expect(host.ctrl.value).toMatchObject({ logradouro: 'Travessa Sem Tipo' });
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

  it('CA-02: fluxo sem CEP escolhe a cidade no campo com busca e compõe o valor', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[role="combobox"]')).toHaveLength(1);

    await escolherCidade(fixture, controller);

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
    await escolherCidade(fixture, controller);

    expect(host.ctrl.value?.cep).toBeNull();
    // O mapeamento para o command não deve montar `endereco` (só cidade).
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).cidadeCodigoIbge).toBe('1504208');
  });

  it('CEP que falha (404) durante o modo manual não vira endereço — #412', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    await escolherCidade(fixture, controller);

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

  it('S1: falha na busca de cidades é dita no campo, sem escolher cidade', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    escolherUf(fixture, 'PA');
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mara';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectOne((r) => r.url === `${BASE}/api/cidades`).flush(null, {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Não foi possível buscar os municípios');
    expect(host.ctrl.value?.cidade ?? null).toBeNull();
  });

  it('o campo que o CEP resolveu sem valor não aparece; com valor, aparece travado', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#t-bairro')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#t-distrito')).toBeNull();
    expect(host.ctrl.value?.distrito).toBeNull();

    botaoPorTexto(fixture, 'Trocar CEP').click();
    fixture.detectChanges();
    setInput(fixture, 't-cep', '68514959');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller
      .expectOne(`${BASE}/api/cep/68514959`)
      .flush({ ...cepLogradouro, cep: '68514959', bairro: 'Morada Nova', distrito: 'Morada Nova' });
    fixture.detectChanges();
    const distrito = fixture.nativeElement.querySelector('#t-distrito') as HTMLInputElement;
    expect(distrito.value).toBe('Morada Nova');
    expect(distrito.readOnly).toBe(true);
  });

  it('o CEP preenche a UF e a cidade, cada uma no seu campo, travadas', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();

    const uf = fixture.nativeElement.querySelector('#t-uf') as HTMLInputElement;
    const cidade = fixture.nativeElement.querySelector('#t-cidade') as HTMLInputElement;
    expect(uf.value).toBe('PA');
    expect(cidade.value).toBe('Marabá');
    expect(uf.readOnly && cidade.readOnly).toBe(true);
  });

  it('sem CEP, a cidade espera a UF, e trocar a UF tira a cidade de outra UF', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(campo.disabled).toBe(true);

    await escolherCidade(fixture, controller);
    expect(host.ctrl.value?.cidade?.codigoIbge).toBe('1504208');

    escolherUf(fixture, 'MA');
    expect(host.ctrl.value?.cidade ?? null).toBeNull();
  });

  it('a cidade escolhida sem CEP pode ser tirada, e o endereço volta a vazio', async () => {
    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();
    await escolherCidade(fixture, controller);
    expect(host.ctrl.value?.cidade?.codigoIbge).toBe('1504208');

    botaoPorTexto(fixture, 'Limpar').click();
    fixture.detectChanges();

    expect(host.ctrl.value?.cidade ?? null).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).cidadeCodigoIbge).toBeNull();
  });

  it('o endereço gravado sem CEP reabre com o nome da cidade no campo', () => {
    host.ctrl.setValue({
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
    fixture.detectChanges();

    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(campo.value).toBe('Marabá (PA)');
  });

  it('trocar para "sem CEP" após resolver limpa e oculta os campos de endereço — #412', async () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller.expectOne(`${BASE}/api/cep/68507590`).flush(cepLogradouro);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#t-logradouro') as HTMLInputElement).value).toBe(
      'Rua Folha 31, Quadra 7',
    );

    botaoPorTexto(fixture, 'preencher sem CEP').click();
    fixture.detectChanges();

    // Campos de endereço ocultos e limpos no fluxo sem CEP (não são descartados em silêncio).
    expect(fixture.nativeElement.querySelector('#t-logradouro')).toBeNull();
    expect(host.ctrl.value?.logradouro ?? null).toBeNull();
    expect(host.ctrl.value?.cep).toBeNull();
    expect(enderecoParaCommand(host.ctrl.value).endereco).toBeNull();
    // A cidade resolvida pelo CEP segue no campo de município, pelo nome.
    const campo = fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(campo.value).toBe('Marabá (PA)');
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

  it('o complemento do CEP no DNE não preenche o do endereço: o usuário o informa', () => {
    setInput(fixture, 't-cep', '68507590');
    botaoPorTexto(fixture, 'Buscar CEP').click();
    controller
      .expectOne(`${BASE}/api/cep/68507590`)
      .flush({ ...cepLogradouro, complemento: 'Clique e Retire Correios' });
    fixture.detectChanges();

    const complemento = fixture.nativeElement.querySelector('#t-complemento') as HTMLInputElement;
    expect(complemento.value).toBe('');
    expect(complemento.readOnly).toBe(false);
    expect(host.ctrl.value?.complemento).toBeNull();
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
