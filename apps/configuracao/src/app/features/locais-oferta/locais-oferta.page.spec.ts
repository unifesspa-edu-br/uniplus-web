import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

  async function flushLista(itens: readonly LocalOfertaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/locais-oferta`);
    req.flush(itens);
    await propagate();
  }

  async function flushCampiLookup(): Promise<void> {
    await propagate();
    controller.expectOne((r) => r.url === `${BASE}/api/campi`).flush([]);
    await propagate();
  }

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

    const post = controller.expectOne(`${BASE}/api/admin/locais-oferta`);
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

  it('exige tipo e cidade — bloqueia salvar inválido', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await flushCampiLookup();
    // sem tipo nem cidade
    component['salvar']();
    controller.expectNone(`${BASE}/api/admin/locais-oferta`);
    expect(component['enderecoErro']()).toContain('cidade');
  });
});
