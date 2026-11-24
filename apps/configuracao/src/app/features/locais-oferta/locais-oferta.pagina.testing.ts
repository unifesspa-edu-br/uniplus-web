import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  LocalOfertaDto,
  VocabulariosDeConfiguracaoApi,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { of } from 'rxjs';
import { expect } from 'vitest';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaPage } from './locais-oferta.page';
import { LocaisOfertaStore } from './locais-oferta.store';
import { TIPO_LOCAL_DE_TESTE, TIPOS_LOCAIS_DE_TESTE } from './locais-oferta.testing';

export const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/locais-oferta`;
export const ESCRITA = `${BASE}/api/configuracao/admin/locais-oferta`;
export const CAMPI = `${BASE}/api/configuracao/campi`;

// Teto de página aceito pela API (ADR-0026 do uniplus-api): `limit` fora da
// faixa 1..100 responde 422 `uniplus.cursor.limit_invalido`, e o lookup
// rejeitado deixa o select vazio e a listagem sem rótulo resolvido.
export const LIMITE_MAXIMO_API = 100;

export const LOCAL_DE_TESTE: LocalOfertaDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: TIPO_LOCAL_DE_TESTE,
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const ENDERECO_RESOLVIDO: EnderecoEstruturado = {
  cep: '68507590',
  logradouro: 'Folha 31',
  numero: null,
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

export const CAMPUS_MARABA = {
  id: 'cmp1',
  sigla: 'MAB',
  nome: 'Campus de Marabá',
  codigoEmec: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const vocabularioDeTiposDeLocal = {
  provide: VocabulariosDeConfiguracaoApi,
  useValue: { listar: () => of({ ok: true, data: TIPOS_LOCAIS_DE_TESTE }) },
};

function configurarModuloDaPagina(): void {
  TestBed.configureTestingModule({
    imports: [LocaisOfertaPage],
    providers: [
      vocabularioDeTiposDeLocal,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: GEO_BASE_PATH, useValue: BASE },
    ],
  });
}

function propagarCom(app: ApplicationRef): () => Promise<void> {
  return async () => {
    await Promise.resolve();
    app.tick();
  };
}

function elementoEm<T>(fixture: ComponentFixture<T>) {
  return <E extends HTMLElement>(seletor: string): E => {
    const achado = (fixture.nativeElement as HTMLElement).querySelector<E>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as E;
  };
}

/** A página de locais de oferta, ainda sem a primeira detecção de mudanças. */
export function montarPaginaDeLocais() {
  configurarModuloDaPagina();
  const fixture = TestBed.createComponent(LocaisOfertaPage);
  const injetor = fixture.debugElement.injector;
  return {
    fixture,
    controller: TestBed.inject(HttpTestingController),
    edicao: injetor.get(EdicaoDosLocaisOferta),
    store: injetor.get(LocaisOfertaStore),
    propagar: propagarCom(TestBed.inject(ApplicationRef)),
    elemento: elementoEm(fixture),
  };
}

export type PaginaDeLocais = ReturnType<typeof montarPaginaDeLocais>;

export function raizDa(pagina: PaginaDeLocais): HTMLElement {
  return pagina.fixture.nativeElement as HTMLElement;
}

export function responderLista(pagina: PaginaDeLocais, itens: readonly LocalOfertaDto[]): void {
  pagina.controller.expectOne((r) => r.url === LISTA).flush(itens);
}

export async function carregarLista(
  pagina: PaginaDeLocais,
  itens: readonly LocalOfertaDto[],
): Promise<void> {
  responderLista(pagina, itens);
  await pagina.propagar();
}

/** Casa a requisição de lookup exigindo `limit` dentro da faixa aceita pela API. */
export function esperarLookup(pagina: PaginaDeLocais, url: string): TestRequest {
  // Comparar só `r.url` não basta: a query string não entra nele quando os
  // parâmetros vêm de `HttpParams`, então um limite inválido passaria batido.
  const req = pagina.controller.expectOne((r) => r.url === url);
  const limit = Number(req.request.params.get('limit'));
  expect(limit).toBeGreaterThanOrEqual(1);
  expect(limit).toBeLessThanOrEqual(LIMITE_MAXIMO_API);
  return req;
}

export async function responderLookupDeCampi(pagina: PaginaDeLocais): Promise<void> {
  await pagina.propagar();
  esperarLookup(pagina, CAMPI).flush([]);
  await pagina.propagar();
}

export function clicarEmNovoLocal(pagina: PaginaDeLocais): void {
  pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
}

export function clicarEmEditarLocal(pagina: PaginaDeLocais): void {
  pagina.elemento<HTMLButtonElement>('button[aria-label^="Editar local de oferta"]').click();
}

export function submeterFormulario(pagina: PaginaDeLocais): void {
  pagina
    .elemento<HTMLFormElement>('#cfg-local-form')
    .dispatchEvent(new Event('submit', { cancelable: true }));
}

export function enviarComFocoNoSalvar(pagina: PaginaDeLocais): void {
  pagina.elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
  submeterFormulario(pagina);
}

export function indisponivel(pagina: PaginaDeLocais, seletor: string): boolean {
  return pagina.elemento(seletor).matches(':disabled');
}

/** Abre o cadastro e responde a busca de campi sem nenhum resultado. */
export async function abrirCadastroComCampi(pagina: PaginaDeLocais): Promise<void> {
  clicarEmNovoLocal(pagina);
  await pagina.propagar();
  pagina.controller.expectOne((r) => r.url === CAMPI).flush([]);
}

/** Abre o cadastro com o formulário preenchido e válido. */
export async function abrirCadastroPreenchido(pagina: PaginaDeLocais): Promise<void> {
  await abrirCadastroComCampi(pagina);
  pagina.edicao.form.setValue({
    tipo: TIPO_LOCAL_DE_TESTE.codigo,
    codigoEmec: '999',
    campusResponsavelId: '',
    endereco: ENDERECO_RESOLVIDO,
  });
  await pagina.propagar();
}

/** Responde a criação com sucesso e a recarga da lista que a segue. */
export async function concluirCriacao(pagina: PaginaDeLocais): Promise<void> {
  pagina.controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
  await pagina.propagar();
  await carregarLista(pagina, [LOCAL_DE_TESTE]);
}

/** A página já com a primeira detecção de mudanças e a lista de um local carregada. */
export async function montarPaginaComListaCarregada(): Promise<PaginaDeLocais> {
  const pagina = montarPaginaDeLocais();
  pagina.fixture.detectChanges();
  await carregarLista(pagina, [LOCAL_DE_TESTE]);
  return pagina;
}

const RESPOSTA_422 = {
  status: 422,
  statusText: 'Unprocessable Entity',
  headers: { 'content-type': 'application/problem+json' },
};

function corpoDeValidacao(campo: string, codigo: string, mensagem: string): string {
  return JSON.stringify({
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    code: 'uniplus.validacao',
    errors: [{ field: campo, code: codigo, message: mensagem }],
  });
}

/** A API recusa o envio apontando um campo do formulário. */
export function recusarCampoDoFormulario(
  pagina: PaginaDeLocais,
  campo: string,
  codigo: string,
  mensagem: string,
): void {
  pagina.controller
    .expectOne(ESCRITA)
    .flush(corpoDeValidacao(campo, codigo, mensagem), RESPOSTA_422);
}

export function mensagemDoEndereco(pagina: PaginaDeLocais): HTMLElement {
  return pagina.elemento('ui-endereco-geo .field__error[role="alert"]');
}

/** A página com a primeira detecção de mudanças feita e a listagem ainda sem resposta. */
export function montarPaginaIniciada(): PaginaDeLocais {
  const pagina = montarPaginaDeLocais();
  pagina.fixture.detectChanges();
  return pagina;
}
