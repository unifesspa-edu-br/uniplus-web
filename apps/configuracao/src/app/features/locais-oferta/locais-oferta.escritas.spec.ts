import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  LocalOfertaDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosLocaisOferta } from './edicao-dos-locais-oferta';
import { LocaisOfertaPage } from './locais-oferta.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/locais-oferta`;
const ESCRITA = `${BASE}/api/configuracao/admin/locais-oferta`;
const local: LocalOfertaDto = {
  id: 'local-1',
  tipo: TipoLocalOferta.poloEad,
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('Escritas de locais de oferta', () => {
  let fixture: ComponentFixture<LocaisOfertaPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let edicao: EdicaoDosLocaisOferta;
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const achado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as T;
  };
  const lista = (): void => controller.expectOne((r) => r.url === LISTA).flush([local]);

  beforeEach(async () => {
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
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDosLocaisOferta);
    fixture.detectChanges();
    lista();
    await propagar();
  });
  afterEach(() => controller.verify());

  async function abrir(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/campi`).flush([]);
    edicao.form.setValue({
      tipo: TipoLocalOferta.poloEad,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: {
        cep: '68507590',
        logradouro: 'Folha 31',
        numero: null,
        complemento: null,
        bairro: 'Nova Marabá',
        distrito: null,
        cidade: local.cidade,
        latitude: null,
        longitude: null,
        nivelResolucao: 'logradouro',
        origem: 'geo-api',
      },
    });
    await propagar();
  }
  async function concluir(): Promise<void> {
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    lista();
    await propagar();
  }

  it('durante envio mantém foco, desabilita campos e bloqueia fechamento e novas ativações', async () => {
    await abrir();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-local-form"]');
    const chamada = vi.spyOn(edicao, 'salvar');
    salvar.focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(elemento<HTMLFieldSetElement>('#cfg-local-form > fieldset').disabled).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]').value).toBe('999');
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando');
    expect(document.activeElement).toBe(salvar);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialog = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário de local de oferta"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    salvar.click();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    expect(chamada).toHaveBeenCalledTimes(1);
    expect(elemento('dialog p[role="status"]').textContent).toContain('Salvando');
    await concluir();
  });

  it('mantém controle desabilitado por regra após recusa e foca o campo recusado', async () => {
    await abrir();
    edicao.form.controls.campusResponsavelId.disable();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    elemento<HTMLFormElement>('#cfg-local-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'CodigoEmec',
            code: 'uniplus.configuracao.local.codigo_invalido',
            message: 'Código inválido.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    await propagar();
    const campo = elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.closest('label')?.textContent).toContain('Código inválido.');
    expect(document.activeElement).toBe(campo);
    expect(edicao.form.controls.campusResponsavelId.disabled).toBe(true);
    expect(edicao.form.controls.codigoEmec.enabled).toBe(true);
  });

  it('recusa escritas concorrentes e mantém a trava até terminar a recarga', async () => {
    await abrir();
    edicao.salvar();
    edicao.salvar();
    edicao.pedirRemocao(local);
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${local.id}`);
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    edicao.abrirCadastro();
    edicao.pedirRemocao(local);
    expect(edicao.formOpen()).toBe(false);
    expect(edicao.confirmOpen()).toBe(false);
    lista();
    await propagar();
    expect(edicao.gravando()).toBe(false);
  });

  it('após sucesso preserva controle desabilitado e devolve foco ao acionador', async () => {
    const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    acionador.focus();
    await abrir();
    edicao.form.controls.campusResponsavelId.disable();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    edicao.salvar();
    await concluir();
    await propagar();
    expect(edicao.form.controls.campusResponsavelId.disabled).toBe(true);
    expect(edicao.form.controls.codigoEmec.enabled).toBe(true);
    expect(document.activeElement).toBe(acionador);
  });

  it('anuncia remoção e recusa acionadores e salvamento até a recarga', async () => {
    edicao.pedirRemocao(local);
    edicao.removerConfirmado();
    await propagar();
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe(
      'Removendo local de oferta.',
    );
    expect(edicao.saving()).toBe(false);
    const novo = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    expect(novo.getAttribute('aria-disabled')).toBe('true');
    novo.click();
    edicao.salvar();
    controller.expectNone(ESCRITA);
    expect(edicao.formOpen()).toBe(false);
    controller
      .expectOne(`${ESCRITA}/${local.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe(
      'Local de oferta removido.',
    );
    expect(edicao.gravando()).toBe(true);
    lista();
    await propagar();
    expect(edicao.gravando()).toBe(false);
  });

  it('anuncia a recusa da remoção e libera as ações', async () => {
    edicao.pedirRemocao(local);
    edicao.removerConfirmado();
    controller
      .expectOne(`${ESCRITA}/${local.id}`)
      .flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Recusado',
          status: 422,
          code: 'uniplus.validacao',
        }),
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagar();
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe(
      'Não foi possível remover o local de oferta.',
    );
    expect(edicao.gravando()).toBe(false);
  });
});
