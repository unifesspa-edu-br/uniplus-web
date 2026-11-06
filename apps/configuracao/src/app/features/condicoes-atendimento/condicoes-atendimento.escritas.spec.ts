import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CondicoesAtendimentoPage } from './condicoes-atendimento.page';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/condicoes-atendimento`;
const ESCRITA = `${BASE}/api/configuracao/admin/condicoes-atendimento`;
const FORMULARIO = '#cfg-condicao-atendimento-form';
const ledor: CondicaoAtendimentoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
const pcd: CondicaoAtendimentoDto = { ...ledor, id: 'pcd-1', codigo: 'PCD', nome: 'Pcd' };
const URL_LEDOR = `${ESCRITA}/${ledor.id}`;
const URL_PCD = `${ESCRITA}/${pcd.id}`;

function problema(status: number, code: string, title: string, errors?: unknown[]) {
  const corpo = { type: 'about:blank', title, status, code, traceId: 't', errors };
  return [
    JSON.stringify(corpo),
    {
      status,
      statusText: title,
      headers: { 'content-type': 'application/problem+json' },
    },
  ] as const;
}
const recusaDoCodigo = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Codigo',
    code: 'uniplus.configuracao.condicao_atendimento.x',
    message: 'Código recusado.',
  },
]);
const duplicado = problema(
  409,
  'uniplus.configuracao.condicao_atendimento.codigo_ja_existe',
  'Já existe uma condição de atendimento ativa com este código',
);
const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
const falhaInterna = problema(500, 'uniplus.erro_interno', 'Erro interno');

describe('Condições de atendimento — escritas pela interface', () => {
  let fixture: ComponentFixture<CondicoesAtendimentoPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let edicao: EdicaoDasCondicoesAtendimento;
  let store: CondicoesAtendimentoStore;
  let sucesso: MockInstance<NotificationService['success']>;
  let erroDoServidor: MockInstance<NotificationService['errorFromProblem']>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CondicoesAtendimentoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CondicoesAtendimentoPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDasCondicoesAtendimento);
    store = fixture.debugElement.injector.get(CondicoesAtendimentoStore);
    const notificacoes = TestBed.inject(NotificationService);
    sucesso = vi.spyOn(notificacoes, 'success');
    erroDoServidor = vi.spyOn(notificacoes, 'errorFromProblem');
    fixture.detectChanges();
    await listar([ledor]);
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
  const salvar = (): HTMLButtonElement => elemento(`button[form="cfg-condicao-atendimento-form"]`);
  const confirmar = (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]');
  const campo = (nome: string): HTMLInputElement =>
    elemento(`[formcontrolname="${nome}"]`) as HTMLInputElement;
  const novo = (): HTMLButtonElement => elemento('.panel-head .btn--primary');
  const acaoDaLinha = (verbo: 'Editar' | 'Remover'): HTMLButtonElement =>
    elemento(`td.table-responsive__actions button[aria-label^="${verbo} condição"]`);
  const retentar = (): HTMLButtonElement => elemento('.list-state__retry button');

  async function listar(itens: readonly CondicaoAtendimentoDto[]): Promise<void> {
    controller.expectOne((r) => r.url === LISTA).flush(itens);
    await propagar();
  }
  async function preencher(): Promise<void> {
    novo().click();
    await propagar();
    edicao.form.setValue({ codigo: 'DISLEXIA', nome: 'Dislexia', descricao: '' });
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
    itens: readonly CondicaoAtendimentoDto[] = [ledor],
  ): Promise<void> {
    await propagar();
    await listar(itens);
    await aguardarFoco();
  }
  async function pedirRemocao(): Promise<void> {
    acaoDaLinha('Remover').click();
    await propagar();
  }
  async function confirmarRemocao(): Promise<void> {
    await pedirRemocao();
    confirmar().click();
    await propagar();
  }

  describe('formulário', () => {
    it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
      await preencher();
      for (const nome of ['codigo', 'nome']) {
        expect(campo(nome).getAttribute('aria-required')).toBe('true');
      }
    });

    it('durante o envio fica somente leitura, mantém o foco no botão e recusa fechar', async () => {
      await preencher();
      await enviar();
      const post = controller.expectOne(ESCRITA);
      expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(true);
      for (const nome of ['codigo', 'nome', 'descricao']) {
        expect(indisponivel(`[formcontrolname="${nome}"]`)).toBe(true);
      }
      expect(campo('codigo').value).toBe('DISLEXIA');
      expect(edicao.salvando()).toBe(true);
      expect(salvar().getAttribute('aria-disabled')).toBe('true');
      expect(salvar().getAttribute('aria-busy')).toBe('true');
      expect(salvar().textContent).toContain('Salvando...');
      await aguardarFoco();
      expect(document.activeElement).toBe(salvar());
      expect(elemento('dialog .sr-only[role="status"]').textContent).toContain('Salvando');
      expect(indisponivel('.form-drawer__footer .btn--tertiary')).toBe(true);
      const dialog = elemento<HTMLDialogElement>(
        'dialog[aria-label="Formulário da condição de atendimento"]',
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

    it('com a recusa do servidor, leva o foco ao campo recusado e renova a chave', async () => {
      await preencher();
      await enviar();
      const chave = controller.expectOne(ESCRITA);
      const primeira = chave.request.headers.get('Idempotency-Key');
      chave.flush(...recusaDoCodigo);
      await aguardarFoco();
      expect(campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(campo('codigo').closest('label')?.textContent).toContain('Código recusado.');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(campo('codigo'));
      expect(indisponivel('[formcontrolname="codigo"]')).toBe(false);
      edicao.form.controls.codigo.setValue('DISLEXIA2');
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(primeira);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
    });

    it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
      await preencher();
      await enviar();
      controller.expectOne(ESCRITA).flush(...recusaDoCodigo);
      await aguardarFoco();

      await enviar();

      controller.expectOne(ESCRITA).flush(...recusaDoCodigo);
      await aguardarFoco();
    });

    it('a edição do código reservado continua travada depois da recusa e do sucesso', async () => {
      edicao.abrirEdicao(pcd);
      edicao.salvar();
      await propagar();
      expect(indisponivel('[formcontrolname="codigo"]')).toBe(true);
      await responder(
        URL_PCD,
        problema(422, 'uniplus.validacao', 'Dados inválidos', [
          { field: 'Nome', code: 'x', message: 'Nome recusado.' },
        ]),
      );
      expect(edicao.form.controls.codigo.disabled).toBe(true);
      expect(indisponivel('[formcontrolname="codigo"]')).toBe(true);
      expect(indisponivel('[formcontrolname="nome"]')).toBe(false);
      expect(document.activeElement).toBe(campo('nome'));
      edicao.form.controls.nome.setValue('Pcd revisada');
      edicao.salvar();
      controller.expectOne(URL_PCD).flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga([pcd]);
      expect(edicao.form.controls.codigo.disabled).toBe(true);
    });

    it('com Enter num campo e falha 500, leva o foco ao botão e mantém a chave para o reenvio', async () => {
      await preencher();
      campo('nome').focus();
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
        code: 'uniplus.erro_interno',
      });
      expect(sucesso).not.toHaveBeenCalled();
      expect(elemento('dialog ui-alert').textContent).toContain('Erro interno');
      expect(indisponivel('[formcontrolname="nome"]')).toBe(false);
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
      expect(document.activeElement).toBe(campo('codigo'));
      expect(campo('codigo').getAttribute('aria-invalid')).toBe('true');
    });

    it('só o código de duplicidade marca o campo e renova a chave', async () => {
      await preencher();
      await enviar();
      const primeira = controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...duplicado);
      await aguardarFoco();
      expect(campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(campo('codigo').closest('label')?.textContent).toContain('Já existe');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(edicao.erro()).toBeNull();
      edicao.form.controls.codigo.setValue('DISLEXIA2');
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
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
      expect(campo('codigo').getAttribute('aria-invalid')).toBeNull();
      expect(erroDoServidor).not.toHaveBeenCalled();
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
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
  });

  describe('concorrência entre escritas', () => {
    it('não inicia outra escrita durante o salvamento nem durante a recarga que o segue', async () => {
      await preencher();
      edicao.salvar();
      edicao.salvar();
      edicao.pedirRemocao(ledor);
      edicao.removerConfirmado();
      controller.expectNone(URL_LEDOR);
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      expect(edicao.gravando()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      edicao.salvar();
      edicao.abrirCadastro();
      edicao.abrirEdicao(ledor);
      edicao.pedirRemocao(ledor);
      edicao.removerConfirmado();
      controller.expectNone(ESCRITA);
      controller.expectNone(URL_LEDOR);
      await concluirRecarga();
      expect(edicao.gravando()).toBe(false);
    });

    it('não inicia salvamento nem outra remoção durante uma remoção', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_LEDOR);
      edicao.form.setValue({ codigo: 'DISLEXIA', nome: 'Dislexia', descricao: '' });
      edicao.salvar();
      edicao.removerConfirmado();
      edicao.abrirCadastro();
      controller.expectNone(ESCRITA);
      controller.expectNone(URL_LEDOR);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga([]);
    });
  });

  describe('remoção', () => {
    it('o pedido de remoção nomeia a condição em negrito e mostra o código', async () => {
      await pedirRemocao();
      expect(elemento('ui-dialog').textContent).toMatch(
        /Você está prestes a remover a condição\s+LEDOR\s+—\s+Ledor\./u,
      );
      expect(elemento('ui-dialog strong').textContent).toBe('Ledor.');
      expect(elemento('ui-dialog code').textContent).toBe('LEDOR');
    });

    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_LEDOR);
      expect(edicao.removendo()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      expect(elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo a condição de atendimento Ledor.',
      );
      expect(confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(confirmar());
      expect(raiz().querySelector('tr span[aria-hidden="true"]')?.textContent).toContain(
        'Removendo',
      );
      for (const botao of raiz().querySelectorAll<HTMLButtonElement>(
        'cfg-condicoes-atendimento-lista button',
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
      controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga([]);
      expect(edicao.confirmando()).toBe(false);
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Condição de atendimento removida');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(elemento(':scope > [role="status"]').textContent).toBe(
        'Condição de atendimento Ledor removida.',
      );
      expect(document.activeElement).toBe(elemento('#cfg-condicoes-atendimento-list-title'));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await confirmarRemocao();
      controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await aguardarFoco();
      expect(edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(elemento('#cfg-condicoes-atendimento-list-title'));
    });

    it.each([
      [
        '409',
        problema(
          409,
          'uniplus.configuracao.condicao_atendimento.remocao_bloqueada_codigo_protegido',
          'A condição reservada não pode ser removida',
        ),
        'A condição reservada não pode ser removida',
      ],
      ['500', falhaInterna, 'Erro interno'],
    ])(
      'recusada (%s), mantém o diálogo aberto com o motivo, o foco no botão e aceita nova tentativa',
      async (nome, resposta, motivo) => {
        await confirmarRemocao();
        await responder(URL_LEDOR, resposta);
        expect(edicao.confirmando()).toBe(true);
        if (nome === '500') {
          expect(erroDoServidor).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ title: motivo }),
            { title: motivo },
          );
        } else {
          expect(erroDoServidor).not.toHaveBeenCalled();
        }
        expect(sucesso).not.toHaveBeenCalled();
        expect(elemento('ui-dialog .field__error').textContent).toBe(motivo);
        expect(elemento('ui-dialog [role="status"]').textContent).toContain(motivo);
        expect(confirmar().getAttribute('aria-disabled')).toBeNull();
        expect(document.activeElement).toBe(confirmar());
        expect(edicao.gravando()).toBe(false);
        confirmar().click();
        await propagar();
        expect(raiz().querySelector('ui-dialog .field__error')).toBeNull();
        controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
        await concluirRecarga([]);
      },
    );

    it('o "Tentar novamente" da listagem fica indisponível com a remoção pendente', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_LEDOR);
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
  });

  describe('foco depois da recarga', () => {
    it('a edição concluída devolve o foco ao botão da linha', async () => {
      acaoDaLinha('Editar').click();
      await propagar();
      edicao.salvar();
      controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Condição de atendimento atualizada');
      expect(document.activeElement).toBe(acaoDaLinha('Editar'));
    });

    it('o cadastro concluído devolve o foco ao botão de nova condição', async () => {
      await preencher();
      edicao.salvar();
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Condição de atendimento criada');
      expect(document.activeElement).toBe(novo());
    });
  });
});
