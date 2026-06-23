import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CampusDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CampiPage } from './campi.page';
import type { EnderecoEstruturado } from '../../shared/endereco';

const BASE = 'http://localhost:5000';

const campusSeed: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const enderecoResolvido: EnderecoEstruturado = {
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
};

describe('CampiPage', () => {
  let fixture: ComponentFixture<CampiPage>;
  let component: CampiPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CampiPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CampiPage);
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

  async function flushLista(itens: readonly CampusDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/campi`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('renderiza a lista de campi com cidade', async () => {
    await flushLista([campusSeed]);
    expect(component['campi']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Campus de Marabá');
    expect(fixture.nativeElement.textContent).toContain('Marabá — PA');
  });

  it('CA-04: cria campus com cidade + endereço aninhado e recarrega a lista', async () => {
    await flushLista([]);

    component['abrirCadastro']();
    component['form'].setValue({
      sigla: 'PARAUAPEBAS',
      nome: 'Campus de Parauapebas',
      codigoEmec: '67890',
      endereco: enderecoResolvido,
    });
    const key = component['idempotencyKeyAtual']();

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/admin/campi`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe(key);
    expect(post.request.body).toMatchObject({
      sigla: 'PARAUAPEBAS',
      nome: 'Campus de Parauapebas',
      cidadeCodigoIbge: '1504208',
      cidadeUf: 'PA',
      endereco: { cep: '68507590', nivelResolucao: 'logradouro' },
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();

    await flushLista([campusSeed]); // refetch pós-mutação
    expect(component['formOpen']()).toBe(false);
  });

  it('bloqueia salvar sem cidade e sinaliza erro no endereço', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ sigla: 'X', nome: 'Sem cidade', endereco: null });

    component['salvar']();

    controller.expectNone(`${BASE}/api/admin/campi`);
    expect(component['enderecoErro']()).toContain('cidade');
  });

  it('remove um campus após confirmação', async () => {
    await flushLista([campusSeed]);
    component['pedirRemocao'](campusSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/admin/campi/${campusSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });
});
