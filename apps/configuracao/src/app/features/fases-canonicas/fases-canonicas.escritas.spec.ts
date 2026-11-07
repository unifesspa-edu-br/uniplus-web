import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';
import { FasesCanonicasPage } from './fases-canonicas.page';
import { FasesCanonicasStore } from './fases-canonicas.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/fases-canonicas`;
const ESCRITA = `${BASE}/api/configuracao/admin/fases-canonicas/f1`;
const fase: FaseCanonicaDto = {
  id: 'f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('FasesCanonicasPage — escritas pela interface', () => {
  let fixture: ComponentFixture<FasesCanonicasPage>;
  let edicao: EdicaoDasFasesCanonicas;
  let store: FasesCanonicasStore;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FasesCanonicasPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(FasesCanonicasPage);
    edicao = fixture.debugElement.injector.get(EdicaoDasFasesCanonicas);
    store = fixture.debugElement.injector.get(FasesCanonicasStore);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === LISTA).flush([fase]);
    controller
      .match((r) => r.url === `${BASE}/api/organizacao/unidades`)
      .forEach((r) => r.flush([]));
    await propagar();
  });
  afterEach(() => controller.verify());

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }
  function elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }
  async function abrir(): Promise<void> {
    elemento<HTMLButtonElement>('button[aria-label="Editar fase canônica AVALIACAO"]').click();
    await propagar();
  }
  async function remover(): Promise<void> {
    elemento<HTMLButtonElement>('button[aria-label="Remover fase canônica AVALIACAO"]').click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  }
  async function concluirRecarga(): Promise<void> {
    await propagar();
    controller.expectOne((r) => r.url === LISTA).flush([fase]);
    await propagar();
  }
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-fase-canonica-form"]');
  const statusDaPagina = (): string =>
    elemento(':scope > span.sr-only[role="status"]').textContent ?? '';
  const botaoPorTexto = (texto: string): HTMLButtonElement | undefined =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === texto,
    );
  const problema = (status: number, corpo: object) =>
    [
      JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
      {
        status,
        statusText: 'Erro',
        headers: { 'content-type': 'application/problem+json' },
      },
    ] as const;
  const recusaDeNome = () =>
    problema(422, {
      code: 'uniplus.validacao',
      errors: [
        {
          field: 'Nome',
          code: 'uniplus.configuracao.fase_canonica.invalido',
          message: 'Nome recusado.',
        },
      ],
    });
  const falhaDoServidor = () => problema(500, { code: 'uniplus.erro' });

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await abrir();
    for (const campo of ['codigo', 'nome', 'origemData']) {
      expect(elemento(`[formcontrolname="${campo}"]`).getAttribute('aria-required')).toBe('true');
    }
  });

  it('envio mantém valores e foco, desabilita fieldset e impede fechar', async () => {
    await abrir();
    edicao.form.controls.descricao.disable();
    salvar().focus();
    salvar().click();
    const requisicao = controller.expectOne(ESCRITA);
    await propagar();
    expect(elemento<HTMLFieldSetElement>('.form-drawer__campos').disabled).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="nome"]').value).toBe('Avaliação');
    expect(edicao.form.controls.nome.enabled).toBe(true);
    expect(salvar().getAttribute('aria-disabled')).toBe('true');
    expect(salvar().getAttribute('aria-busy')).toBe('true');
    expect(salvar().textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(salvar());
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialogo = elemento<HTMLDialogElement>('dialog[aria-label="Formulário de fase canônica"]');
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.aberto()).toBe(true);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
    expect(edicao.aberto()).toBe(false);
    expect(elemento('[formcontrolname="descricao"]').matches(':disabled')).toBe(true);
  });

  it('clique e submit durante envio recusam nova ativação', async () => {
    await abrir();
    const chamada = vi.spyOn(edicao, 'salvar');
    salvar().click();
    const requisicao = controller.expectOne(ESCRITA);
    await propagar();
    salvar().click();
    elemento<HTMLFormElement>('#cfg-fase-canonica-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    expect(chamada).toHaveBeenCalledTimes(1);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
  });

  it('recusa no campo devolve foco ao campo e preserva controles desabilitados', async () => {
    await abrir();
    edicao.form.controls.descricao.disable();
    salvar().click();
    await propagar();
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'teste',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.fase_canonica.invalido',
            message: 'Nome recusado.',
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
    expect(elemento('input[formcontrolname="nome"]').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(elemento('input[formcontrolname="nome"]'));
    expect(elemento('[formcontrolname="descricao"]').matches(':disabled')).toBe(true);
  });

  it('remoção anuncia estado e recusa edição e remoção concorrentes', async () => {
    await remover();
    const requisicao = controller.expectOne(ESCRITA);
    expect(requisicao.request.method).toBe('DELETE');
    expect(edicao.gravando()).toBe(true);
    expect(edicao.salvando()).toBe(false);
    expect(elemento<HTMLFieldSetElement>('.form-drawer__campos').disabled).toBe(false);
    expect(salvar().textContent).toContain('Salvar fase canônica');
    expect(elemento('td[data-label="Código"]').textContent).toContain('Removendo...');
    const dialogo = elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.confirmando()).toBe(true);
    expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
      'Removendo a fase AVALIACAO.',
    );
    const editar = elemento<HTMLButtonElement>(
      'button[aria-label="Editar fase canônica AVALIACAO"]',
    );
    expect(editar.disabled).toBe(true);
    editar.click();
    edicao.abrirEdicao(fase);
    edicao.salvar();
    edicao.removerConfirmado();
    expect(edicao.aberto()).toBe(false);
    controller.expectNone(ESCRITA);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
    expect(elemento('span.sr-only[role="status"]').textContent).toContain(
      'Fase AVALIACAO removida.',
    );
  });

  it('salvamento bloqueia escritas concorrentes e mantém a trava durante recarga', async () => {
    await abrir();
    edicao.salvar();
    edicao.salvar();
    edicao.pedirRemocao(fase);
    edicao.removerConfirmado();
    const requisicao = controller.expectOne(ESCRITA);
    expect(requisicao.request.method).toBe('PUT');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    const recarga = controller.expectOne((r) => r.url === LISTA);
    expect(edicao.gravando()).toBe(true);
    expect(edicao.salvando()).toBe(false);
    edicao.abrirEdicao(fase);
    edicao.pedirRemocao(fase);
    edicao.salvar();
    edicao.removerConfirmado();
    controller.expectNone(ESCRITA);
    recarga.flush([fase]);
    await propagar();
    expect(edicao.gravando()).toBe(false);
  });

  it('mantém o rótulo da escrita na linha enquanto a lista recarrega', async () => {
    await remover();
    controller.expectOne(ESCRITA).flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    const recarga = controller.expectOne((r) => r.url === LISTA);
    expect(elemento('td[data-label="Código"]').textContent).toContain('Removendo...');
    expect(elemento('td[data-label="Código"]').textContent).not.toContain('Salvando');
    recarga.flush([fase]);
    await propagar();
    expect(elemento('td[data-label="Código"]').textContent).not.toContain('...');
  });

  it('não repete na página a recusa do formulário depois de Cancelar', async () => {
    await abrir();
    salvar().click();
    controller.expectOne(ESCRITA).flush(...recusaDeNome());
    await propagar();
    expect(elemento('ui-drawer [role="status"]').textContent).toContain(
      'Revise os campos indicados.',
    );
    elemento<HTMLButtonElement>('.form-drawer__footer button').click();
    await propagar();
    expect(edicao.aberto()).toBe(false);
    expect(statusDaPagina()).toBe('');
    await abrir();
    expect(elemento('ui-drawer [role="status"]').textContent?.trim()).toBe('');
  });

  it('falha geral do salvamento é anunciada só pelo alerta, não pela região de status', async () => {
    await abrir();
    salvar().click();
    controller.expectOne(ESCRITA).flush(...falhaDoServidor());
    await propagar();
    expect(elemento('ui-drawer ui-alert').textContent).toContain('Falha');
    expect(elemento('ui-drawer [role="status"]').textContent?.trim()).toBe('');
  });

  describe('chave de idempotência após recusa do servidor', () => {
    async function chavesDoEnvioRecusado(status: number, corpo: object): Promise<[string, string]> {
      await abrir();
      salvar().click();
      const primeira = controller.expectOne(ESCRITA);
      const chaveEnviada = primeira.request.headers.get('Idempotency-Key') as string;
      primeira.flush(...problema(status, corpo));
      await propagar();
      salvar().click();
      const segunda = controller.expectOne(ESCRITA);
      const chaveReenviada = segunda.request.headers.get('Idempotency-Key') as string;
      segunda.flush(...falhaDoServidor());
      await propagar();
      return [chaveEnviada, chaveReenviada];
    }

    it('mantém a chave quando a execução anterior ainda corre (409 de processamento)', async () => {
      const [enviada, reenviada] = await chavesDoEnvioRecusado(409, {
        code: 'uniplus.idempotency.processing_conflict',
      });
      expect(enviada).toBeTruthy();
      expect(reenviada).toBe(enviada);
    });

    it('renova a chave após recusa definitiva do servidor, mesmo com 409', async () => {
      const [enviada, reenviada] = await chavesDoEnvioRecusado(409, {
        code: 'uniplus.configuracao.conflito',
      });
      expect(reenviada).not.toBe(enviada);
    });

    it('mantém a chave quando o servidor falha (5xx)', async () => {
      const [enviada, reenviada] = await chavesDoEnvioRecusado(500, { code: 'uniplus.erro' });
      expect(reenviada).toBe(enviada);
    });
  });

  it('não repete na página a falha da remoção depois de Cancelar', async () => {
    await remover();
    controller.expectOne(ESCRITA).flush(...falhaDoServidor());
    await propagar();
    const dialogo = elemento('cfg-confirmacao-de-remocao dialog');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'Não foi possível remover a fase AVALIACAO.',
    );
    expect(edicao.confirmando()).toBe(true);
    const cancelar = [...dialogo.querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Cancelar',
    );
    cancelar?.click();
    await propagar();
    expect(edicao.confirmando()).toBe(false);
    expect(statusDaPagina()).toBe('');
  });

  it('abrir a edição apaga o desfecho anterior da página', async () => {
    await remover();
    controller.expectOne(ESCRITA).flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
    expect(statusDaPagina()).toContain('Fase AVALIACAO removida.');
    await abrir();
    elemento<HTMLButtonElement>('.form-drawer__footer button').click();
    await propagar();
    expect(statusDaPagina()).toBe('');
  });

  it('fecha o diálogo de remoção quando o navegador o fecha', async () => {
    elemento<HTMLButtonElement>('button[aria-label="Remover fase canônica AVALIACAO"]').click();
    await propagar();
    const dialogo = elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');
    dialogo.dispatchEvent(new Event('close'));
    await propagar();
    expect(edicao.confirmando()).toBe(false);
  });

  it('a remoção pendente não deixa uma escrita concorrente tomar o andamento', async () => {
    edicao.pedirRemocao(fase);
    edicao.confirmando.set(false);
    edicao.abrirEdicao(fase);
    edicao.salvar();
    const salvamento = controller.expectOne(ESCRITA);
    expect(edicao.andamento()).toEqual({ id: 'f1', rotulo: 'Salvando...' });
    edicao.removerConfirmado();
    controller.expectNone(ESCRITA);
    expect(edicao.andamento()).toEqual({ id: 'f1', rotulo: 'Salvando...' });
    expect(edicao.anuncioDaRemocao()).toBe('');
    expect(edicao.anuncioDoSalvamento()).toBe('Salvando fase canônica.');
    salvamento.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
  });

  it('clicar em Remover durante a remoção é recusado e não dispara outra requisição', async () => {
    await remover();
    const requisicao = controller.expectOne(ESCRITA);
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    elemento('[data-testid="confirm-dialog-confirm"]').dispatchEvent(clique);
    await propagar();
    expect(clique.defaultPrevented).toBe(true);
    controller.expectNone(ESCRITA);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
  });

  it('nova tentativa de remoção apaga a falha anterior', async () => {
    await remover();
    controller.expectOne(ESCRITA).flush(...falhaDoServidor());
    await propagar();
    expect(edicao.erroRemocao()).not.toBeNull();
    edicao.removerConfirmado();
    expect(edicao.erroRemocao()).toBeNull();
    controller.expectOne(ESCRITA).flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
  });

  it('deixa indisponível "Tentar novamente" enquanto a remoção pende e a listagem falha', async () => {
    await remover();
    const remocao = controller.expectOne(ESCRITA);
    store.recarregar();
    await propagar();
    controller.expectOne((r) => r.url === LISTA).flush(...falhaDoServidor());
    await propagar();
    expect(botaoPorTexto('Tentar novamente')?.getAttribute('aria-disabled')).toBe('true');
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga();
  });

  describe('foco do envio e da nova tentativa', () => {
    const campoNome = (): HTMLInputElement => elemento('input[formcontrolname="nome"]');
    const submeter = (): void => {
      elemento<HTMLFormElement>('#cfg-fase-canonica-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
    };

    it('Enter num campo leva o foco ao botão de salvar e a falha do servidor o mantém ali', async () => {
      await abrir();
      campoNome().focus();
      submeter();
      await propagar();
      expect(campoNome().matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(salvar());

      controller.expectOne(ESCRITA).flush(...falhaDoServidor());
      await propagar();
      await propagar();

      expect(edicao.aberto()).toBe(true);
      expect(document.activeElement).toBe(salvar());
    });

    it('envio barrado com o foco no botão de salvar leva o foco ao primeiro campo inválido', async () => {
      await abrir();
      edicao.form.controls.nome.setValue('');
      edicao.form.controls.origemData.setValue('');
      salvar().focus();
      submeter();
      await propagar();
      await propagar();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoNome());
    });

    it('"Tentar novamente" que dá certo leva o foco, que estava no botão, ao título da lista', async () => {
      store.recarregar();
      await propagar();
      controller.expectOne((r) => r.url === LISTA).flush(...falhaDoServidor());
      await propagar();
      const tentar = botaoPorTexto('Tentar novamente') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await propagar();

      controller.expectOne((r) => r.url === LISTA).flush([fase]);
      await propagar();
      await propagar();

      expect(document.activeElement).toBe(elemento('#cfg-fases-canonicas-list-title'));
    });
  });
});
