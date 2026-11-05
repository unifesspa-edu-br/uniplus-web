import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/referencias-reserva-demografica`;
const ESCRITA = `${BASE}/api/configuracao/admin/referencias-reserva-demografica`;
const referencia: ReferenciaReservaDemograficaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('Reserva demográfica — escritas pela interface', () => {
  let fixture: ComponentFixture<ReservaDemograficaListPage>;
  let edicao: EdicaoDasReservasDemograficas;
  let http: HttpTestingController;
  let app: ApplicationRef;

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const lista = async (): Promise<void> => {
    http.expectOne((r) => r.url === LISTA).flush([referencia]);
    await propagar();
  };
  const abrir = async (): Promise<void> => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
  };
  const preencher = async (): Promise<void> => {
    await abrir();
    for (const [nome, valor] of Object.entries({
      censoReferencia: '2010',
      ppiPercentual: '70',
      quilombolaPercentual: '1',
      pcdPercentual: '8',
    })) {
      const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }
    await propagar();
  };
  const enviar = (): void => {
    elemento<HTMLFormElement>('#cfg-reserva-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  };
  const remover = async (): Promise<void> => {
    elemento<HTMLButtonElement>(
      'button[aria-label="Remover reserva demográfica do censo 2022"]',
    ).click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  };
  const concluir = async (): Promise<void> => {
    await propagar();
    await lista();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ReservaDemograficaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ReservaDemograficaListPage);
    edicao = fixture.debugElement.injector.get(EdicaoDasReservasDemograficas);
    http = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await lista();
  });
  afterEach(() => http.verify());

  it('mantém o formulário somente leitura e impede fechamento e reenvio durante o envio', async () => {
    const salvarClasse = vi.spyOn(edicao, 'salvar');
    await preencher();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-reserva-form"]');
    salvar.focus();
    enviar();
    const post = http.expectOne(ESCRITA);
    await propagar();
    expect(elemento<HTMLFieldSetElement>('#cfg-reserva-form fieldset').disabled).toBe(true);
    expect(
      elemento<HTMLInputElement>('[formcontrolname="censoReferencia"]').matches(':disabled'),
    ).toBe(true);
    expect(elemento<HTMLInputElement>('[formcontrolname="censoReferencia"]').value).toBe('2010');
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(salvar);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialogo = elemento<HTMLDialogElement>('ui-drawer dialog');
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    salvar.click();
    elemento<HTMLFormElement>('#cfg-reserva-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    expect(salvarClasse).toHaveBeenCalledTimes(1);
    post.flush('id', { status: 201, statusText: 'Created' });
    await concluir();
  });

  it('anuncia a remoção e recusa os acionadores enquanto a escrita e a recarga correm', async () => {
    await remover();
    const requisicao = http.expectOne(`${ESCRITA}/${referencia.id}`);
    expect(edicao.removendo()).toBe(true);
    expect(edicao.salvando()).toBe(false);
    expect(elemento('ui-dialog [role="status"]').textContent).toContain(
      'Removendo a referência do Censo 2022',
    );
    const novo = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    expect(novo.getAttribute('aria-disabled')).toBe('true');
    novo.click();
    edicao.salvar();
    edicao.removerConfirmado();
    expect(edicao.formOpen()).toBe(false);
    http.expectNone(ESCRITA);
    http.expectNone(`${ESCRITA}/${referencia.id}`);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    novo.click();
    edicao.pedirRemocao(referencia);
    edicao.removerConfirmado();
    expect(edicao.formOpen()).toBe(false);
    http.expectNone(`${ESCRITA}/${referencia.id}`);
    await lista();
    expect(edicao.gravando()).toBe(false);
    expect(elemento('.sr-only[role="status"]').textContent).toContain(
      'Referência do Censo 2022 removida',
    );
  });

  it('impede remoção e nova gravação durante o salvamento e a recarga', async () => {
    await preencher();
    enviar();
    const post = http.expectOne(ESCRITA);
    edicao.salvar();
    edicao.pedirRemocao(referencia);
    edicao.removerConfirmado();
    http.expectNone(ESCRITA);
    http.expectNone(`${ESCRITA}/${referencia.id}`);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    edicao.abrirCadastro();
    edicao.pedirRemocao(referencia);
    edicao.removerConfirmado();
    expect(edicao.formOpen()).toBe(false);
    http.expectNone(`${ESCRITA}/${referencia.id}`);
    await lista();
    expect(edicao.gravando()).toBe(false);
  });

  it('mantém o censo desabilitado por regra de negócio após recusa e foca o campo recusado', async () => {
    elemento<HTMLButtonElement>(
      'button[aria-label="Editar reserva demográfica do censo 2022"]',
    ).click();
    await propagar();
    enviar();
    expect(edicao.form.controls.censoReferencia.disabled).toBe(true);
    expect(edicao.form.controls.ppiPercentual.enabled).toBe(true);
    http.expectOne(`${ESCRITA}/${referencia.id}`).flush(
      JSON.stringify({
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'PpiPercentual',
            code: 'uniplus.percentual.invalido',
            message: 'Percentual recusado.',
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
    const campo = elemento<HTMLInputElement>('[formcontrolname="ppiPercentual"]');
    expect(edicao.form.controls.censoReferencia.disabled).toBe(true);
    expect(campo.getAttribute('aria-describedby')).toBe('erro-ppiPercentual');
    expect(document.activeElement).toBe(campo);
    expect(elemento('#erro-ppiPercentual').textContent).toContain('Percentual recusado.');
  });

  it('leva o foco ao primeiro campo inválido sem enviar', async () => {
    await abrir();
    enviar();
    await propagar();
    const campo = elemento<HTMLInputElement>('[formcontrolname="censoReferencia"]');
    expect(document.activeElement).toBe(campo);
    expect(campo.getAttribute('aria-describedby')).toBe('erro-censoReferencia');
    http.expectNone(ESCRITA);
  });
  it('envia o formulário pelo clique no botão de criação', async () => {
    await preencher();
    elemento<HTMLButtonElement>('button[form="cfg-reserva-form"]').click();
    const post = http.expectOne(ESCRITA);
    expect(post.request.body.censoReferencia).toBe('2010');
    post.flush('id', { status: 201, statusText: 'Created' });
    await concluir();
  });

  it('mostra e foca a recusa do censo desabilitado na edição', async () => {
    elemento<HTMLButtonElement>(
      'button[aria-label="Editar reserva demográfica do censo 2022"]',
    ).click();
    await propagar();
    enviar();
    http
      .expectOne(`${ESCRITA}/${referencia.id}`)
      .flush(
        JSON.stringify({
          status: 422,
          title: 'Dados inválidos',
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'CensoReferencia',
              code: 'uniplus.censo.invalido',
              message: 'Censo recusado.',
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
    const erro = elemento<HTMLElement>('#cfg-reserva-erro');
    expect(erro.textContent).toContain('Censo recusado.');
    expect(document.activeElement).toBe(erro);
  });

  it('limpa o anúncio ao fechar e abrir novamente o formulário', async () => {
    await preencher();
    enviar();
    http
      .expectOne(ESCRITA)
      .flush(JSON.stringify({ status: 500, title: 'Falha', code: 'uniplus.erro' }), {
        status: 500,
        statusText: 'Error',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagar();
    expect(edicao.anuncioFormulario()).not.toBe('');
    edicao.fechar();
    expect(edicao.anuncioFormulario()).toBe('');
    edicao.anuncioFormulario.set('anúncio antigo');
    edicao.abrirCadastro();
    expect(edicao.anuncioFormulario()).toBe('');
  });

  it('limpa erro geral antes de validar um novo envio', async () => {
    await abrir();
    edicao.formError.set('Erro anterior');
    enviar();
    await propagar();
    expect(edicao.formError()).toBeNull();
    expect(document.activeElement).toBe(elemento('[formcontrolname="censoReferencia"]'));
    http.expectNone(ESCRITA);
  });
});
