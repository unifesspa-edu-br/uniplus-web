import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';
import { ReservaDemograficaStore } from './reserva-demografica.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/referencias-reserva-demografica`;
const ESCRITA = `${BASE}/api/configuracao/admin/referencias-reserva-demografica`;
const FORMULARIO = '#cfg-reserva-form';
const CODIGO_DUPLICADO = 'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe';
const referencia: ReferenciaReservaDemograficaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};
const URL_DA_REFERENCIA = `${ESCRITA}/${referencia.id}`;
const VALORES_VALIDOS = {
  censoReferencia: '2010',
  ppiPercentual: 70,
  quilombolaPercentual: 1,
  pcdPercentual: 8,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
};

function problema(status: number, code: string, title: string, errors?: unknown[]) {
  const corpo = { type: 'about:blank', title, status, code, traceId: 't', errors };
  return [
    JSON.stringify(corpo),
    { status, statusText: title, headers: { 'content-type': 'application/problem+json' } },
  ] as const;
}
const recusaDoPercentual = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'PpiPercentual',
    code: 'uniplus.configuracao.referencia_reserva_demografica.percentual_fora_de_faixa',
    message: 'Percentual recusado.',
  },
]);
const duplicado = problema(409, CODIGO_DUPLICADO, 'Já existe uma referência ativa para este Censo');
const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
const naoEncontrada = problema(
  404,
  'uniplus.configuracao.referencia_reserva_demografica.nao_encontrada',
  'Referência de reserva demográfica não encontrada',
);
const falhaInterna = problema(500, 'uniplus.internal.unexpected', 'Erro interno');

describe('Reserva demográfica — escritas pela interface', () => {
  let fixture: ComponentFixture<ReservaDemograficaListPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let edicao: EdicaoDasReservasDemograficas;
  let store: ReservaDemograficaStore;
  let sucesso: MockInstance<NotificationService['success']>;
  let erroDoServidor: MockInstance<NotificationService['errorFromProblem']>;

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
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDasReservasDemograficas);
    store = fixture.debugElement.injector.get(ReservaDemograficaStore);
    const notificacoes = TestBed.inject(NotificationService);
    sucesso = vi.spyOn(notificacoes, 'success');
    erroDoServidor = vi.spyOn(notificacoes, 'errorFromProblem');
    fixture.detectChanges();
    await listar([referencia]);
  });
  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const aguardarFoco = async (): Promise<void> => {
    await propagar();
    await fixture.whenStable();
    await propagar();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const achado = raiz().querySelector<T>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as T;
  };
  const indisponivel = (seletor: string): boolean => elemento(seletor).matches(':disabled');
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-reserva-form"]');
  const confirmar = (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]');
  const campo = (nome: string): HTMLInputElement =>
    elemento(`[formcontrolname="${nome}"]`) as HTMLInputElement;
  const novo = (): HTMLButtonElement => elemento('.panel-head .btn--primary');
  const acaoDaLinha = (verbo: 'Editar' | 'Remover'): HTMLButtonElement =>
    elemento(`td.table-responsive__actions button[aria-label^="${verbo} reserva"]`);
  const retentar = (): HTMLButtonElement => elemento('.list-state__retry button');

  async function listar(itens: readonly ReferenciaReservaDemograficaDto[]): Promise<void> {
    controller.expectOne((r) => r.url === LISTA).flush(itens);
    await propagar();
  }
  async function preencher(): Promise<void> {
    novo().click();
    await propagar();
    edicao.form.setValue(VALORES_VALIDOS);
    await propagar();
  }
  async function enviar(): Promise<void> {
    salvar().focus();
    elemento<HTMLFormElement>(FORMULARIO).dispatchEvent(new Event('submit', { cancelable: true }));
    await propagar();
  }
  async function responder(
    url: string,
    resposta: readonly [
      string,
      { status: number; statusText: string; headers?: Record<string, string> },
    ],
  ): Promise<void> {
    controller.expectOne(url).flush(...resposta);
    await propagar();
    await aguardarFoco();
  }
  async function concluirRecarga(
    itens: readonly ReferenciaReservaDemograficaDto[] = [referencia],
  ): Promise<void> {
    await propagar();
    await listar(itens);
    await aguardarFoco();
  }
  async function pedirRemocao(): Promise<void> {
    acaoDaLinha('Remover').click();
    await propagar();
    expect(elemento('ui-dialog').textContent).toContain('Censo 2022');
  }
  async function confirmarRemocao(): Promise<void> {
    await pedirRemocao();
    confirmar().click();
    await propagar();
  }

  describe('formulário', () => {
    it('durante o envio fica somente leitura, mantém o foco no botão e recusa fechar', async () => {
      await preencher();
      await enviar();
      const post = controller.expectOne(ESCRITA);
      expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(true);
      for (const nome of ['censoReferencia', 'ppiPercentual', 'baseLegal']) {
        expect(indisponivel(`[formcontrolname="${nome}"]`)).toBe(true);
      }
      expect(campo('censoReferencia').value).toBe('2010');
      expect(edicao.salvando()).toBe(true);
      expect(salvar().getAttribute('aria-disabled')).toBe('true');
      expect(salvar().getAttribute('aria-busy')).toBe('true');
      expect(salvar().textContent).toContain('Salvando...');
      await aguardarFoco();
      expect(document.activeElement).toBe(salvar());
      expect(elemento('dialog .sr-only[role="status"]').textContent).toContain('Salvando');
      expect(indisponivel('.form-drawer__footer .btn--tertiary')).toBe(true);
      const dialog = elemento<HTMLDialogElement>(
        'dialog[aria-label="Formulário de referência demográfica"]',
      );
      expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
        true,
      );
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      edicao.fechar();
      await propagar();
      expect(edicao.aberto()).toBe(true);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
      expect(edicao.aberto()).toBe(false);
    });

    it('recusa clique e submissão enquanto o envio está em curso', async () => {
      const chamada = vi.spyOn(edicao, 'salvar');
      await preencher();
      await enviar();
      const post = controller.expectOne(ESCRITA);
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      salvar().dispatchEvent(clique);
      elemento<HTMLFormElement>(FORMULARIO).dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await propagar();
      expect(clique.defaultPrevented).toBe(true);
      expect(chamada).toHaveBeenCalledTimes(1);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('com a recusa do servidor, leva o foco ao campo recusado, renova a chave e não notifica', async () => {
      await preencher();
      await enviar();
      const primeira = controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...recusaDoPercentual);
      await aguardarFoco();
      expect(campo('ppiPercentual').getAttribute('aria-invalid')).toBe('true');
      expect(campo('ppiPercentual').closest('label')?.textContent).toContain(
        'Percentual recusado.',
      );
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(campo('ppiPercentual'));
      expect(indisponivel('[formcontrolname="ppiPercentual"]')).toBe(false);
      edicao.form.controls.ppiPercentual.setValue(60);
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
      await preencher();
      await enviar();
      controller.expectOne(ESCRITA).flush(...recusaDoPercentual);
      await aguardarFoco();

      await enviar();

      controller.expectOne(ESCRITA).flush(...recusaDoPercentual);
      await aguardarFoco();
    });

    it('o censo travado na edição continua travado depois da recusa e do sucesso', async () => {
      edicao.abrirEdicao(referencia);
      edicao.salvar();
      await propagar();
      expect(indisponivel('[formcontrolname="censoReferencia"]')).toBe(true);
      await responder(URL_DA_REFERENCIA, recusaDoPercentual);
      expect(edicao.form.controls.censoReferencia.disabled).toBe(true);
      expect(indisponivel('[formcontrolname="censoReferencia"]')).toBe(true);
      expect(indisponivel('[formcontrolname="ppiPercentual"]')).toBe(false);
      expect(document.activeElement).toBe(campo('ppiPercentual'));
      edicao.form.controls.ppiPercentual.setValue(60);
      edicao.salvar();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga();
      expect(edicao.form.controls.censoReferencia.disabled).toBe(true);
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Referência atualizada');
    });

    it('com Enter num campo e falha 500, leva o foco ao botão, notifica e mantém a chave para o reenvio', async () => {
      await preencher();
      campo('baseLegal').focus();
      elemento<HTMLFormElement>(FORMULARIO).dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await propagar();
      await aguardarFoco();
      expect(document.activeElement).toBe(salvar());
      const requisicao = controller.expectOne(ESCRITA);
      const chave = requisicao.request.headers.get('Idempotency-Key');
      requisicao.flush(...falhaInterna);
      await aguardarFoco();
      expect(edicao.erro()).toBe('Erro interno');
      expect(erroDoServidor).toHaveBeenCalledTimes(1);
      expect(erroDoServidor.mock.calls[0][0]).toMatchObject({
        status: 500,
        code: 'uniplus.internal.unexpected',
      });
      expect(sucesso).not.toHaveBeenCalled();
      expect(elemento('dialog ui-alert').textContent).toContain('Erro interno');
      expect(indisponivel('[formcontrolname="baseLegal"]')).toBe(false);
      expect(salvar().getAttribute('aria-disabled')).toBeNull();
      await enviar();
      const reenvio = controller.expectOne(ESCRITA);
      expect(reenvio.request.headers.get('Idempotency-Key')).toBe(chave);
      reenvio.flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('o envio barrado leva o foco ao primeiro campo inválido', async () => {
      novo().click();
      await propagar();
      await enviar();
      await aguardarFoco();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campo('censoReferencia'));
      expect(campo('censoReferencia').getAttribute('aria-invalid')).toBe('true');
    });

    it('só o código de duplicidade marca o campo do censo, renova a chave e não notifica', async () => {
      await preencher();
      await enviar();
      const primeira = controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...duplicado);
      await aguardarFoco();
      expect(campo('censoReferencia').getAttribute('aria-invalid')).toBe('true');
      expect(campo('censoReferencia').closest('label')?.textContent).toContain('Já existe');
      expect(document.activeElement).toBe(campo('censoReferencia'));
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(edicao.erro()).toBeNull();
      edicao.form.controls.censoReferencia.setValue('2011');
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('a duplicidade na edição, com o censo travado, vira mensagem geral e não invalida o formulário', async () => {
      edicao.abrirEdicao(referencia);
      edicao.salvar();
      await propagar();
      await responder(URL_DA_REFERENCIA, duplicado);
      expect(edicao.erro()).toBe('Já existe uma referência ativa para este Censo');
      expect(edicao.form.controls.censoReferencia.errors).toBeNull();
      expect(edicao.form.invalid).toBe(false);
      expect(erroDoServidor).not.toHaveBeenCalled();
      edicao.salvar();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga();
    });

    it('o conflito de processamento mantém a chave, mostra a mensagem e não marca o campo', async () => {
      await preencher();
      await enviar();
      const primeira = controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...processando);
      await aguardarFoco();
      expect(edicao.erro()).toBe('A requisição anterior ainda está em processamento');
      expect(campo('censoReferencia').getAttribute('aria-invalid')).toBeNull();
      expect(erroDoServidor).not.toHaveBeenCalled();
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('outro 409 renova a chave e mostra a mensagem geral sem notificar', async () => {
      await preencher();
      await enviar();
      const primeira = controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(409, 'uniplus.idempotency.body_mismatch', 'Corpo divergente'));
      await aguardarFoco();
      expect(edicao.erro()).toBe('Corpo divergente');
      expect(campo('censoReferencia').getAttribute('aria-invalid')).toBeNull();
      expect(erroDoServidor).not.toHaveBeenCalled();
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('a recusa sem campo reconhecido vira mensagem geral', async () => {
      await preencher();
      await enviar();
      controller
        .expectOne(ESCRITA)
        .flush(
          ...problema(422, 'uniplus.validacao', 'Dados inválidos', [
            { field: 'Outro', code: 'x', message: 'Recusado.' },
          ]),
        );
      await aguardarFoco();
      expect(edicao.erro()).toContain('Não foi possível mapear');
    });

    it('limpa a mensagem geral no início de um novo envio, mesmo barrado localmente', async () => {
      await preencher();
      await enviar();
      controller.expectOne(ESCRITA).flush(...falhaInterna);
      await aguardarFoco();
      expect(edicao.erro()).toBe('Erro interno');
      edicao.form.controls.censoReferencia.setValue('');
      await enviar();
      await aguardarFoco();
      expect(edicao.erro()).toBeNull();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campo('censoReferencia'));
    });
  });

  describe('concorrência entre escritas', () => {
    it('não inicia outra escrita durante o salvamento nem durante a recarga que o segue', async () => {
      await preencher();
      edicao.salvar();
      edicao.salvar();
      edicao.pedirRemocao(referencia);
      edicao.removerConfirmado();
      controller.expectNone(URL_DA_REFERENCIA);
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      expect(edicao.gravando()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      edicao.salvar();
      edicao.abrirCadastro();
      edicao.abrirEdicao(referencia);
      edicao.pedirRemocao(referencia);
      edicao.removerConfirmado();
      expect(edicao.aberto()).toBe(false);
      expect(edicao.confirmando()).toBe(false);
      controller.expectNone(ESCRITA);
      controller.expectNone(URL_DA_REFERENCIA);
      await concluirRecarga();
      expect(edicao.gravando()).toBe(false);
    });

    it('não inicia salvamento nem outra remoção durante uma remoção', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_DA_REFERENCIA);
      edicao.form.setValue(VALORES_VALIDOS);
      edicao.salvar();
      edicao.removerConfirmado();
      edicao.abrirCadastro();
      controller.expectNone(ESCRITA);
      controller.expectNone(URL_DA_REFERENCIA);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga([]);
    });
  });

  describe('remoção', () => {
    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_DA_REFERENCIA);
      expect(edicao.removendo()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      expect(elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo a referência do Censo 2022.',
      );
      expect(confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(confirmar());
      expect(raiz().querySelector('tr span[aria-hidden="true"]')?.textContent).toContain(
        'Removendo',
      );
      for (const botao of raiz().querySelectorAll<HTMLButtonElement>(
        'cfg-reserva-demografica-lista button',
      )) {
        expect(botao.matches(':disabled'), botao.textContent ?? '').toBe(true);
      }
      expect(indisponivel('[data-testid="confirm-dialog-cancel"]')).toBe(true);
      novo().click();
      expect(edicao.aberto()).toBe(false);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      expect(edicao.gravando()).toBe(true);
      await concluirRecarga([]);
      expect(edicao.gravando()).toBe(false);
    });

    it('concluída, anuncia o resultado na página e leva o foco ao título da lista', async () => {
      await confirmarRemocao();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga([]);
      expect(edicao.confirmando()).toBe(false);
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Referência removida', '2022');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(elemento(':scope > [role="status"]').textContent).toBe(
        'Referência do Censo 2022 removida.',
      );
      expect(document.activeElement).toBe(elemento('#cfg-reserva-list-title'));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await confirmarRemocao();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await aguardarFoco();
      expect(edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(elemento('#cfg-reserva-list-title'));
    });

    it('recusada (404), mantém o diálogo aberto com o motivo e o foco no botão, sem notificar', async () => {
      await confirmarRemocao();
      await responder(URL_DA_REFERENCIA, naoEncontrada);
      expect(edicao.confirmando()).toBe(true);
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(sucesso).not.toHaveBeenCalled();
      expect(elemento('ui-dialog .field__error').textContent).toBe(
        'Referência de reserva demográfica não encontrada',
      );
      expect(elemento('ui-dialog [role="status"]').textContent).toContain(
        'Referência de reserva demográfica não encontrada',
      );
      expect(confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(confirmar());
      expect(edicao.gravando()).toBe(false);
    });

    it('recusada por falha do servidor (500), notifica, mantém o diálogo aberto e aceita nova tentativa', async () => {
      await confirmarRemocao();
      await responder(URL_DA_REFERENCIA, falhaInterna);
      expect(edicao.confirmando()).toBe(true);
      expect(erroDoServidor).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: 500 }),
        { title: 'Não foi possível remover a referência' },
      );
      expect(sucesso).not.toHaveBeenCalled();
      expect(elemento('ui-dialog .field__error').textContent).toBe('Erro interno');
      expect(document.activeElement).toBe(confirmar());
      confirmar().click();
      await propagar();
      expect(raiz().querySelector('ui-dialog .field__error')).toBeNull();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga([]);
    });

    it('o "Tentar novamente" da listagem fica indisponível com a remoção pendente', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_DA_REFERENCIA);
      store.tentarNovamente();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await propagar();
      expect(retentar().getAttribute('aria-disabled')).toBe('true');
      retentar().click();
      controller.expectNone((r) => r.url === LISTA);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush([]);
      await aguardarFoco();
    });
  });

  describe('leitura', () => {
    it('a falha 5xx da listagem notifica com o título resolvido', async () => {
      store.tentarNovamente();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(...falhaInterna);
      await propagar();
      expect(erroDoServidor).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: 500 }),
        { title: 'Erro interno' },
      );
    });

    it('a falha 4xx da listagem não notifica o servidor', async () => {
      store.tentarNovamente();
      await propagar();
      controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, 'uniplus.acesso_negado', 'Acesso negado'));
      await propagar();
      expect(erroDoServidor).not.toHaveBeenCalled();
    });

    it('"Tentar novamente" bem-sucedido tira o alerta e leva o foco ao título da lista', async () => {
      store.tentarNovamente();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await propagar();
      retentar().focus();
      retentar().click();
      await propagar();
      await listar([referencia]);
      await aguardarFoco();
      expect(raiz().querySelector('.list-state__retry')).toBeNull();
      expect(document.activeElement).toBe(elemento('#cfg-reserva-list-title'));
    });
  });

  describe('foco depois da recarga', () => {
    it('a edição concluída devolve o foco ao botão da linha e notifica o sucesso', async () => {
      acaoDaLinha('Editar').click();
      await propagar();
      edicao.salvar();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Referência atualizada');
      expect(document.activeElement).toBe(acaoDaLinha('Editar'));
    });

    it('o cadastro concluído devolve o foco ao botão de novo censo e notifica o sucesso', async () => {
      await preencher();
      edicao.salvar();
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Referência criada');
      expect(document.activeElement).toBe(novo());
    });

    it('o cadastro concluído com a recarga falha devolve o foco ao botão de novo censo', async () => {
      await preencher();
      edicao.salvar();
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await aguardarFoco();
      expect(document.activeElement).toBe(novo());
    });

    it('a edição concluída com a recarga falha, sem a linha na tela, leva o foco ao título da lista', async () => {
      acaoDaLinha('Editar').click();
      await propagar();
      edicao.salvar();
      controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await aguardarFoco();
      expect(document.activeElement).toBe(elemento('#cfg-reserva-list-title'));
    });
  });
});
