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
import { CONFIGURACAO_BASE_PATH, LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocaisOfertaPage } from './locais-oferta.page';
import type { EnderecoEstruturado } from '../../shared/endereco';

const BASE = 'http://localhost:5000';
// Teto de página aceito pela API (ADR-0026 do uniplus-api): `limit` fora da
// faixa 1..100 responde 422 `uniplus.cursor.limit_invalido`, e o lookup
// rejeitado deixa o select vazio e a listagem sem rótulo resolvido.
const LIMITE_MAXIMO_API = 100;

const localSeed: LocalOfertaDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: 'poloEad',
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const enderecoResolvido: EnderecoEstruturado = {
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

describe('LocaisOfertaPage', () => {
  let fixture: ComponentFixture<LocaisOfertaPage>;
  let component: LocaisOfertaPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LocaisOfertaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(LocaisOfertaPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  // Casa a requisição de lookup exigindo `limit` dentro da faixa aceita pela
  // API. Comparar só `r.url` não basta: a query string não entra nele quando os
  // parâmetros vêm de `HttpParams`, então um limite inválido passaria batido.
  const expectLookup = (url: string): TestRequest => {
    const req = controller.expectOne((r) => r.url === url);
    const limit = Number(req.request.params.get('limit'));
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(LIMITE_MAXIMO_API);
    return req;
  };

  async function flushLista(itens: readonly LocalOfertaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/locais-oferta`);
    req.flush(itens);
    await propagate();
  }

  async function flushCampiLookup(): Promise<void> {
    await propagate();
    expectLookup(`${BASE}/api/configuracao/campi`).flush([]);
    await propagate();
  }

  it('pede o máximo de uma página da API no lookup de campi responsáveis', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();
    const campi = expectLookup(`${BASE}/api/configuracao/campi`);
    campi.flush([]);

    // O valor pedido é o teto da API, não um número escolhido à toa: acima
    // dele a resposta é 422 e o select fica sem opção.
    expect(campi.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
  });

  it('cancela o lookup de campi anterior ao clicar "Tentar novamente" antes da resposta chegar', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();

    const primeira = expectLookup(`${BASE}/api/configuracao/campi`);

    component['recarregarCampi']();
    await propagate();

    // A primeira travessia precisa ter sido cancelada de verdade (não só
    // ignorada) — senão ela ainda pode ganhar a corrida se responder por
    // último, sobrescrevendo o resultado da segunda com dado obsoleto.
    expect(primeira.cancelled).toBe(true);

    const segunda = expectLookup(`${BASE}/api/configuracao/campi`);
    segunda.flush([
      {
        id: 'cmp1',
        sigla: 'MAB',
        nome: 'Campus de Marabá',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();

    expect(component['campiOpcoes']()).toHaveLength(1);

    // Se a primeira ainda estivesse "viva", flush aqui explodiria (request já
    // consumido) ou reabriria uma disputa — confirma que não sobra nada pendente.
    controller.verify();
  });

  it('renderiza a lista com tipo e cidade', async () => {
    await flushLista([localSeed]);
    expect(component['locais']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Polo EAD');
    expect(fixture.nativeElement.textContent).toContain('Marabá — PA');
  });

  it('CA-04: cria local de oferta com tipo + endereço aninhado', async () => {
    await flushLista([]);

    component['abrirCadastro']();
    await flushCampiLookup();
    component['form'].setValue({
      tipo: 'poloEad',
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: enderecoResolvido,
    });

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/locais-oferta`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({
      tipo: 'poloEad',
      campusResponsavelId: null,
      cidadeCodigoIbge: '1504208',
      endereco: { cep: '68507590' },
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([localSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('I1: lista com local vinculado dispara o lookup de campi e exibe a sigla/nome', async () => {
    const localVinculado: LocalOfertaDto = { ...localSeed, campusResponsavelId: 'cmp1' };
    await flushLista([localVinculado]);
    await propagate();
    expectLookup(`${BASE}/api/configuracao/campi`).flush([
      {
        id: 'cmp1',
        sigla: 'MAB',
        nome: 'Campus de Marabá',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();
    expect(component['campusLabel']('cmp1')).toBe('MAB — Campus de Marabá');
  });

  it('percorre todas as páginas do lookup de campi sem truncar', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();

    const pagina1 = expectLookup(`${BASE}/api/configuracao/campi`);
    pagina1.flush(
      [
        {
          id: 'cmp1',
          sigla: 'MAB',
          nome: 'Campus de Marabá',
          codigoEmec: null,
          cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
          endereco: null,
          criadoEm: '2026-06-10T12:00:00Z',
        },
      ],
      {
        headers: {
          Link: `<${BASE}/api/configuracao/campi?cursor=pagina-2&direction=next>; rel="next"`,
        },
      },
    );
    await propagate();

    // Segunda página vem só com o cursor — sem `limit`, por contrato do client
    // gerado — então não reaproveita `expectLookup` (que exige `limit`).
    const pagina2 = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/campi`);
    expect(pagina2.request.params.get('cursor')).toBe('pagina-2');
    expect(pagina2.request.params.get('direction')).toBe('next');
    pagina2.flush([
      {
        id: 'cmp2',
        sigla: 'XIN',
        nome: 'Campus de Xinguara',
        codigoEmec: null,
        cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        endereco: null,
        criadoEm: '2026-06-10T12:00:00Z',
      },
    ]);
    await propagate();

    expect(component['campiOpcoes']()).toHaveLength(2);
    expect(component['campusLabel']('cmp1')).toBe('MAB — Campus de Marabá');
    expect(component['campusLabel']('cmp2')).toBe('XIN — Campus de Xinguara');
  });

  it('exige tipo e cidade — bloqueia salvar inválido', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await flushCampiLookup();
    // sem tipo nem cidade
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/locais-oferta`);
    expect(component['enderecoErro']()).toContain('cidade');
  });
});
