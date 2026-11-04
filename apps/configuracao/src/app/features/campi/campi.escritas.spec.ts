import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CampusDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CampiPage } from './campi.page';
import { EdicaoDosCampi } from './edicao-dos-campi';

const BASE = 'http://localhost:5000';
const LISTA_URL = `${BASE}/api/configuracao/campi`;
const ESCRITA_URL = `${BASE}/api/configuracao/admin/campi`;

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

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let fixture: ComponentFixture<CampiPage>;
  let edicao: EdicaoDosCampi;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
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
    edicao = fixture.debugElement.injector.get(EdicaoDosCampi);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await responderLista();
  });

  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function responderLista(): Promise<void> {
    controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    await propagar();
  }

  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  };

  const digitar = (seletor: string, valor: string): void => {
    const input = elemento<HTMLInputElement>(seletor);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };

  async function preencherNovoCampus(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    digitar('input[formcontrolname="sigla"]', 'PARAUAPEBAS');
    digitar('input[formcontrolname="nome"]', 'Campus de Parauapebas');
    // O endereço é um controle composto resolvido pelo Geo; os demais campos são digitados.
    edicao.form.controls.endereco.setValue(enderecoResolvido);
  }

  const enviarFormulario = (): void =>
    elemento<HTMLButtonElement>('button[form="cfg-campus-form"]').click();

  async function pedirRemocao(): Promise<void> {
    elemento<HTMLButtonElement>('button[aria-label="Remover campus MARABA"]').click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  }

  function recusar(corpo: object): void {
    controller.expectOne(ESCRITA_URL).flush(JSON.stringify(corpo), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    });
  }

  it('gravação pendente bloqueia nova submissão e a remoção', async () => {
    await preencherNovoCampus();
    enviarFormulario();
    const post = controller.expectOne(ESCRITA_URL);

    enviarFormulario();
    await pedirRemocao();

    controller.expectNone((r) => r.url.startsWith(ESCRITA_URL));
    expect(edicao.gravando()).toBe(true);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
  });

  it('remoção pendente bloqueia a submissão do formulário', async () => {
    await pedirRemocao();
    const delete$ = controller.expectOne(`${ESCRITA_URL}/${campusSeed.id}`);

    await preencherNovoCampus();
    enviarFormulario();

    controller.expectNone(ESCRITA_URL);
    delete$.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === LISTA_URL).flush([]);
  });

  it('recusa do servidor é mostrada no campo recusado', async () => {
    await preencherNovoCampus();
    enviarFormulario();
    recusar({
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'test-trace',
      errors: [
        {
          field: 'Sigla',
          code: 'uniplus.configuracao.campus.sigla_ja_existe',
          message: 'Sigla já cadastrada.',
        },
      ],
    });
    await propagar();

    const campo = elemento('input[formcontrolname="sigla"]').closest('label') as HTMLElement;
    expect(campo.querySelector('.field__error')?.textContent?.trim()).toBe('Sigla já cadastrada.');
    expect(elemento('input[formcontrolname="sigla"]').getAttribute('aria-invalid')).toBe('true');
  });

  it('recusa do servidor sobre o endereço é mostrada no bloco do endereço', async () => {
    await preencherNovoCampus();
    enviarFormulario();
    recusar({
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'test-trace',
      errors: [
        {
          field: 'CidadeCodigoIbge',
          code: 'uniplus.configuracao.campus.cidade_divergente',
          message: 'A cidade não corresponde ao CEP informado.',
        },
      ],
    });
    await propagar();

    const erro = elemento('ui-endereco-geo .field__error');
    expect(erro.textContent?.trim()).toBe('A cidade não corresponde ao CEP informado.');
  });
});
