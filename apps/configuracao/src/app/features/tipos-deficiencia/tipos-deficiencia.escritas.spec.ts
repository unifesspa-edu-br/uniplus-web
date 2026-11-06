import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';
import { TiposDeficienciaListPage } from './tipos-deficiencia-list.page';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-deficiencia`;
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-deficiencia`;
const FORMULARIO = '#cfg-tipo-deficiencia-form';
const visual: TipoDeficienciaDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: null,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
const URL_VISUAL = `${ESCRITA}/${visual.id}`;
const TITULO = '#cfg-tipos-deficiencia-list-title';

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
    code: 'uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido',
    message: 'Código recusado.',
  },
]);
const codigoDuplicado = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe',
  'Já existe um tipo de deficiência ativo com este código',
);
const nomeDuplicado = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
  'Já existe um tipo de deficiência ativo com este nome',
);
const processando = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
const falhaInterna = problema(500, 'uniplus.erro_interno', 'Erro interno');
const criado = ['novo-id', { status: 201, statusText: 'Created' }] as const;
const semConteudo = [null, { status: 204, statusText: 'No Content' }] as const;

type RespostaSimulada = readonly [
  string | null,
  { status: number; statusText: string; headers?: Record<string, string> },
];

describe('Tipos de deficiência — escritas pela interface', () => {
  let fixture: ComponentFixture<TiposDeficienciaListPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let edicao: EdicaoDosTiposDeficiencia;
  let store: TiposDeficienciaStore;
  let sucesso: MockInstance<NotificationService['success']>;
  let erroDoServidor: MockInstance<NotificationService['errorFromProblem']>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TiposDeficienciaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposDeficienciaListPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposDeficiencia);
    store = fixture.debugElement.injector.get(TiposDeficienciaStore);
    const notificacoes = TestBed.inject(NotificationService);
    sucesso = vi.spyOn(notificacoes, 'success');
    erroDoServidor = vi.spyOn(notificacoes, 'errorFromProblem');
    fixture.detectChanges();
    await listar([visual]);
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
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-tipo-deficiencia-form"]');
  const confirmar = (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]');
  const campo = (nome: string): HTMLInputElement =>
    elemento(`[formcontrolname="${nome}"]`) as HTMLInputElement;
  const novo = (): HTMLButtonElement => elemento('.panel-head .btn--primary');
  const acaoDaLinha = (verbo: 'Editar' | 'Remover'): HTMLButtonElement =>
    elemento(`td.table-responsive__actions button[aria-label^="${verbo} tipo"]`);
  const retentar = (): HTMLButtonElement => elemento('.list-state__retry button');

  async function listar(itens: readonly TipoDeficienciaDto[]): Promise<void> {
    controller.expectOne((r) => r.url === LISTA).flush(itens);
    await propagar();
  }
  async function preencher(): Promise<void> {
    novo().click();
    await propagar();
    edicao.form.setValue({ nome: 'Auditiva', codigo: 'AUDITIVA', descricao: 'Perda auditiva' });
    await propagar();
  }
  async function enviar(): Promise<void> {
    salvar().focus();
    elemento<HTMLFormElement>(FORMULARIO).dispatchEvent(new Event('submit', { cancelable: true }));
    await propagar();
  }
  async function responder(url: string, resposta: RespostaSimulada): Promise<void> {
    controller.expectOne(url).flush(...resposta);
    await propagar();
    await aguardarFoco();
  }
  async function concluirRecarga(itens: readonly TipoDeficienciaDto[] = [visual]): Promise<void> {
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
      for (const nome of ['nome', 'codigo', 'descricao']) {
        expect(campo(nome).getAttribute('aria-required')).toBe('true');
      }
    });

    it('durante o envio fica somente leitura, mantém o foco no botão e recusa fechar', async () => {
      await preencher();
      await enviar();
      const post = controller.expectOne(ESCRITA);
      expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(true);
      for (const nome of ['nome', 'codigo', 'descricao']) {
        expect(indisponivel(`[formcontrolname="${nome}"]`)).toBe(true);
      }
      expect(campo('codigo').value).toBe('AUDITIVA');
      expect(edicao.salvando()).toBe(true);
      expect(salvar().getAttribute('aria-disabled')).toBe('true');
      expect(salvar().getAttribute('aria-busy')).toBe('true');
      expect(salvar().textContent).toContain('Salvando...');
      await aguardarFoco();
      expect(document.activeElement).toBe(salvar());
      expect(elemento('dialog .sr-only[role="status"]').textContent).toContain('Salvando');
      expect(indisponivel('.form-drawer__footer .btn--tertiary')).toBe(true);
      const dialog = elemento<HTMLDialogElement>(
        'dialog[aria-label="Formulário do tipo de deficiência"]',
      );
      expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
        true,
      );
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      edicao.fechar();
      await propagar();
      expect(edicao.aberto()).toBe(true);
      post.flush(...criado);
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
      post.flush(...criado);
      await concluirRecarga();
    });

    it('com a recusa do servidor, leva o foco ao campo recusado, renova a chave e não notifica', async () => {
      await preencher();
      await enviar();
      const envio = controller.expectOne(ESCRITA);
      const primeira = envio.request.headers.get('Idempotency-Key');
      envio.flush(...recusaDoCodigo);
      await aguardarFoco();
      expect(campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(campo('codigo').closest('label')?.textContent).toContain('Código recusado.');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(campo('codigo'));
      expect(indisponivel('[formcontrolname="codigo"]')).toBe(false);
      edicao.form.controls.codigo.setValue('AUDITIVA_2');
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(primeira);
      segunda.flush(...criado);
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Tipo de deficiência criado');
      expect(document.activeElement).toBe(novo());
    });

    it('com Enter num campo e falha 500, leva o foco ao botão, notifica e mantém a chave para o reenvio', async () => {
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
      reenvio.flush(...criado);
      await concluirRecarga();
    });

    it.each<[string, RespostaSimulada]>([
      ['sucesso', criado],
      ['recusa', recusaDoCodigo],
    ])('preserva o controle desabilitado por regra após %s', async (resultado, resposta) => {
      await preencher();
      edicao.form.controls.descricao.disable();
      await propagar();
      await enviar();
      controller.expectOne(ESCRITA).flush(...resposta);
      await propagar();
      if (resultado === 'sucesso') await concluirRecarga();
      else await aguardarFoco();
      expect(edicao.form.controls.descricao.disabled).toBe(true);
      expect(edicao.form.controls.nome.enabled).toBe(true);
      if (resultado === 'recusa') {
        expect(indisponivel('[formcontrolname="descricao"]')).toBe(true);
        expect(indisponivel('[formcontrolname="nome"]')).toBe(false);
        expect(edicao.aberto()).toBe(true);
      }
    });

    it('o envio barrado leva o foco ao primeiro campo inválido', async () => {
      novo().click();
      await propagar();
      await enviar();
      await aguardarFoco();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campo('nome'));
      expect(campo('nome').getAttribute('aria-invalid')).toBe('true');
    });

    it.each<[string, RespostaSimulada, string, string]>([
      [
        'código',
        codigoDuplicado,
        'codigo',
        'Já existe um tipo de deficiência ativo com este código',
      ],
      ['nome', nomeDuplicado, 'nome', 'Já existe um tipo de deficiência ativo com este nome'],
    ])(
      'a duplicidade de %s marca o campo certo, renova a chave e não notifica',
      async (_rotulo, resposta, controle, mensagem) => {
        await preencher();
        await enviar();
        const primeira = controller.expectOne(ESCRITA);
        const chave = primeira.request.headers.get('Idempotency-Key');
        primeira.flush(...resposta);
        await aguardarFoco();
        expect(campo(controle).getAttribute('aria-invalid')).toBe('true');
        expect(campo(controle).closest('label')?.textContent).toContain(mensagem);
        expect(document.activeElement).toBe(campo(controle));
        expect(erroDoServidor).not.toHaveBeenCalled();
        expect(edicao.erro()).toBeNull();
        edicao.form.controls[controle as 'nome' | 'codigo'].setValue('OUTRO_VALOR');
        await enviar();
        const segunda = controller.expectOne(ESCRITA);
        expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
        segunda.flush(...criado);
        await concluirRecarga();
      },
    );

    it('o conflito de processamento mantém a chave, mostra a mensagem e não marca o campo', async () => {
      await preencher();
      await enviar();
      const primeira = controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...processando);
      await aguardarFoco();
      expect(edicao.erro()).toBe('A requisição anterior ainda está em processamento');
      expect(campo('codigo').getAttribute('aria-invalid')).toBeNull();
      expect(campo('nome').getAttribute('aria-invalid')).toBeNull();
      expect(erroDoServidor).not.toHaveBeenCalled();
      await enviar();
      const segunda = controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(...criado);
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
      edicao.pedirRemocao(visual);
      edicao.removerConfirmado();
      controller.expectNone(URL_VISUAL);
      controller.expectOne(ESCRITA).flush(...criado);
      await propagar();
      expect(edicao.gravando()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      edicao.salvar();
      edicao.abrirCadastro();
      edicao.abrirEdicao(visual);
      edicao.pedirRemocao(visual);
      edicao.removerConfirmado();
      controller.expectNone(ESCRITA);
      controller.expectNone(URL_VISUAL);
      await concluirRecarga();
      expect(edicao.gravando()).toBe(false);
    });

    it('não inicia salvamento nem outra remoção durante uma remoção', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_VISUAL);
      edicao.form.setValue({ nome: 'Sala', codigo: 'SALA', descricao: 'Perda auditiva' });
      edicao.salvar();
      edicao.removerConfirmado();
      edicao.abrirCadastro();
      controller.expectNone(ESCRITA);
      controller.expectNone(URL_VISUAL);
      delecao.flush(...semConteudo);
      await concluirRecarga([]);
    });
  });

  describe('remoção', () => {
    it('o pedido de remoção nomeia o tipo na confirmação', async () => {
      await pedirRemocao();
      expect(elemento('ui-dialog').textContent).toMatch(
        /Você está prestes a remover o tipo de deficiência\s+VISUAL\s+—\s+Visual\./u,
      );
      expect(elemento('ui-dialog strong').textContent).toBe('Visual.');
      expect(elemento('ui-dialog code').textContent).toBe('VISUAL');
      confirmar().click();
      await propagar();
      controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await concluirRecarga([]);
    });

    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_VISUAL);
      expect(edicao.removendo()).toBe(true);
      expect(edicao.salvando()).toBe(false);
      expect(elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo o tipo de deficiência Visual.',
      );
      expect(confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(confirmar());
      expect(raiz().querySelector('tr span[aria-hidden="true"]')?.textContent).toContain(
        'Removendo',
      );
      for (const botao of raiz().querySelectorAll<HTMLButtonElement>(
        'cfg-tipos-deficiencia-lista button',
      )) {
        expect(botao.matches(':disabled'), botao.textContent ?? '').toBe(true);
      }
      expect(indisponivel('[data-testid="confirm-dialog-cancel"]')).toBe(true);
      novo().click();
      expect(edicao.aberto()).toBe(false);
      delecao.flush(...semConteudo);
      await propagar();
      expect(edicao.gravando()).toBe(true);
      await concluirRecarga([]);
      expect(edicao.gravando()).toBe(false);
    });

    it('concluída, notifica o sucesso, anuncia o resultado na página e leva o foco ao título da lista', async () => {
      await confirmarRemocao();
      controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await concluirRecarga([]);
      expect(edicao.confirmando()).toBe(false);
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Tipo de deficiência removido');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(elemento(':scope > [role="status"]').textContent).toBe(
        'Tipo de deficiência Visual removido.',
      );
      expect(document.activeElement).toBe(elemento(TITULO));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await confirmarRemocao();
      controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await aguardarFoco();
      expect(edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(elemento(TITULO));
    });

    it.each([
      [
        '404',
        problema(
          404,
          'uniplus.configuracao.tipo_deficiencia.nao_encontrado',
          'Tipo de deficiência não encontrado',
        ),
        'Tipo de deficiência não encontrado',
      ],
      ['500', falhaInterna, 'Erro interno'],
    ])(
      'recusada (%s), mantém o diálogo aberto com o motivo, o foco no botão e aceita nova tentativa',
      async (nome, resposta, motivo) => {
        await confirmarRemocao();
        await responder(URL_VISUAL, resposta);
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
        controller.expectOne(URL_VISUAL).flush(...semConteudo);
        await concluirRecarga([]);
      },
    );

    it('o "Tentar novamente" da listagem fica indisponível com a remoção pendente', async () => {
      await confirmarRemocao();
      const delecao = controller.expectOne(URL_VISUAL);
      store.tentarNovamente();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await propagar();
      expect(retentar().getAttribute('aria-disabled')).toBe('true');
      retentar().click();
      controller.expectNone((r) => r.url === LISTA);
      delecao.flush(...semConteudo);
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
      await listar([visual]);
      await aguardarFoco();
      expect(raiz().querySelector('.list-state__retry')).toBeNull();
      expect(document.activeElement).toBe(elemento(TITULO));
    });
  });

  describe('edição recusada', () => {
    it.each([
      [
        '404',
        problema(
          404,
          'uniplus.configuracao.tipo_deficiencia.nao_encontrado',
          'Tipo de deficiência não encontrado',
        ),
        'Tipo de deficiência não encontrado',
      ],
      [
        'body_mismatch',
        problema(
          422,
          'uniplus.idempotency.body_mismatch',
          'A chave de idempotência já foi usada com outro conteúdo',
        ),
        'A chave de idempotência já foi usada com outro conteúdo',
      ],
    ])(
      'com a recusa %s, mostra o motivo sem notificar, mantém o formulário aberto e renova a chave',
      async (_rotulo, resposta, motivo) => {
        acaoDaLinha('Editar').click();
        await propagar();
        await enviar();
        const primeira = controller.expectOne(URL_VISUAL);
        const chave = primeira.request.headers.get('Idempotency-Key');
        primeira.flush(...resposta);
        await aguardarFoco();
        expect(edicao.erro()).toBe(motivo);
        expect(elemento('dialog ui-alert').textContent).toContain(motivo);
        expect(erroDoServidor).not.toHaveBeenCalled();
        expect(sucesso).not.toHaveBeenCalled();
        expect(edicao.aberto()).toBe(true);
        await enviar();
        const segunda = controller.expectOne(URL_VISUAL);
        expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
        segunda.flush(...semConteudo);
        await concluirRecarga();
      },
    );
  });

  describe('foco depois da recarga', () => {
    it('a edição concluída notifica e devolve o foco ao botão da linha', async () => {
      acaoDaLinha('Editar').click();
      await propagar();
      edicao.salvar();
      controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Tipo de deficiência atualizado');
      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(acaoDaLinha('Editar'));
    });

    it('a edição concluída, com falha na recarga, leva o foco ao título da lista', async () => {
      acaoDaLinha('Editar').click();
      await propagar();
      edicao.salvar();
      controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(null, { status: 500, statusText: 'Erro' });
      await aguardarFoco();
      expect(document.activeElement).toBe(elemento(TITULO));
    });

    it('o cadastro concluído notifica e devolve o foco ao botão de novo tipo', async () => {
      await preencher();
      edicao.salvar();
      controller.expectOne(ESCRITA).flush(...criado);
      await concluirRecarga();
      expect(sucesso).toHaveBeenCalledExactlyOnceWith('Tipo de deficiência criado');
      expect(document.activeElement).toBe(novo());
    });
  });
});
