import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CondicoesAtendimentoListPage } from './condicoes-atendimento-list';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/condicoes-atendimento`;
const ESCRITA = `${BASE}/api/configuracao/admin/condicoes-atendimento`;
const condicao: CondicaoAtendimentoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('Condições de atendimento — escritas pela interface', () => {
  let fixture: ComponentFixture<CondicoesAtendimentoListPage>;
  let edicao: EdicaoDasCondicoesAtendimento;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const el = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(el, seletor).not.toBeNull();
    return el as T;
  };
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-unidade-form"]');
  const concluirRecarga = async (): Promise<void> => {
    await propagar();
    controller.expectOne((r) => r.url === LISTA).flush([condicao]);
    await propagar();
  };
  async function preencher(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    for (const [campo, valor] of [
      ['codigo', 'DISLEXIA'],
      ['nome', 'Dislexia'],
    ]) {
      const input = elemento<HTMLInputElement>(`input[formcontrolname="${campo}"]`);
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }
    await propagar();
  }
  async function remover(): Promise<void> {
    elemento<HTMLButtonElement>(
      'button[aria-label="Remover condição de atendimento LEDOR"]',
    ).click();
    await propagar();
    const botoes = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'ui-dialog button',
      ),
    ];
    const confirmar = botoes.find((botao) => botao.textContent?.trim() === 'Remover');
    expect(confirmar).toBeDefined();
    confirmar?.click();
    await propagar();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CondicoesAtendimentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CondicoesAtendimentoListPage);
    edicao = fixture.debugElement.injector.get(EdicaoDasCondicoesAtendimento);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await concluirRecarga();
  });
  afterEach(() => controller.verify());

  it('mantém o formulário somente leitura e impede fechar durante o envio', async () => {
    await preencher();
    const botao = salvar();
    botao.focus();
    botao.click();
    const post = controller.expectOne(ESCRITA);
    await propagar();
    expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="codigo"]').matches(':disabled')).toBe(
      true,
    );
    expect(edicao.form.controls.codigo.value).toBe('DISLEXIA');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(botao);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer .btn--tertiary').disabled).toBe(true);
    const dialog = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário da condição de atendimento"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await concluirRecarga();
  });

  it('recusa clique e submissão enquanto o botão está aria-disabled', async () => {
    const chamada = vi.spyOn(edicao, 'salvar');
    await preencher();
    salvar().click();
    const post = controller.expectOne(ESCRITA);
    await propagar();
    salvar().click();
    elemento<HTMLFormElement>('#cfg-unidade-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(chamada).toHaveBeenCalledTimes(1);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await concluirRecarga();
  });

  it('leva o foco ao campo recusado pelo servidor', async () => {
    await preencher();
    salvar().focus();
    salvar().click();
    await propagar();
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Codigo',
            code: 'uniplus.configuracao.condicao_atendimento.invalido',
            message: 'Código recusado.',
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
    expect(elemento('input[formcontrolname="codigo"]').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(elemento('input[formcontrolname="codigo"]'));
  });

  it('anuncia a remoção e impede ações até terminar a recarga', async () => {
    await remover();
    const requisicao = controller.expectOne(`${ESCRITA}/${condicao.id}`);
    expect(edicao.removendo()).toBe(true);
    expect(edicao.salvando()).toBe(false);
    expect(elemento('ui-dialog [role="status"]').textContent).toContain('Removendo');
    const indicador = elemento('tr span[aria-hidden="true"]');
    expect(indicador.textContent).toContain('Removendo');
    expect(indicador.hasAttribute('role')).toBe(false);
    const novo = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    expect(novo.getAttribute('aria-disabled')).toBe('true');
    novo.click();
    expect(edicao.formOpen()).toBe(false);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.saving()).toBe(true);
    novo.click();
    expect(edicao.formOpen()).toBe(false);
    await concluirRecarga();
    expect(edicao.saving()).toBe(false);
  });

  it('mantém uma região de status para anunciar o início e o fim da remoção', async () => {
    const status = elemento<HTMLElement>('.sr-only[role="status"]');
    await remover();
    const statusDoDialogo = elemento<HTMLElement>('ui-dialog [role="status"]');
    expect(statusDoDialogo.textContent?.trim()).toBe('Removendo a condição de atendimento Ledor.');
    expect(edicao.confirmOpen()).toBe(true);
    controller.expectOne(`${ESCRITA}/${condicao.id}`).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await concluirRecarga();
    expect(edicao.confirmOpen()).toBe(false);
    expect(status.textContent?.trim()).toBe('Condição de atendimento Ledor removida.');
  });

  it('não inicia outra escrita durante o salvamento ou a recarga', async () => {
    await preencher();
    edicao.salvar();
    edicao.salvar();
    edicao.abrirRemoverCondicao(condicao);
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${condicao.id}`);
    controller.expectOne(ESCRITA).flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    edicao.salvar();
    edicao.abrirRemoverCondicao(condicao);
    edicao.removerConfirmado();
    controller.expectNone(ESCRITA);
    controller.expectNone(`${ESCRITA}/${condicao.id}`);
    await concluirRecarga();
  });

  it('não inicia salvamento nem outra remoção durante uma remoção', async () => {
    await remover();
    const requisicao = controller.expectOne(`${ESCRITA}/${condicao.id}`);
    edicao.form.setValue({ codigo: 'DISLEXIA', nome: 'Dislexia', descricao: '' });
    edicao.salvar();
    edicao.removerConfirmado();
    controller.expectNone(ESCRITA);
    controller.expectNone(`${ESCRITA}/${condicao.id}`);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
  });
});
