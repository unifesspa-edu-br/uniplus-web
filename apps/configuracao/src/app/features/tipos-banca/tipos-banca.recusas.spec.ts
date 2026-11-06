import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';
import { TiposBancaPage } from './tipos-banca.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-banca`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-banca/b2`;
const TITULO_DA_LISTA = '#cfg-tipos-banca-list-title';
const banca: TipoBancaDto = {
  id: 'b2',
  codigo: 'BANCA_ENTREVISTA',
  nome: 'Banca de Entrevista',
  faseTipica: null,
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const problema = (status: number, corpo: object) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;

describe('TiposBancaPage — recusas e foco', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let edicao: EdicaoDosTiposBanca;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TiposBancaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposBancaPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposBanca);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === LISTA).flush([banca]);
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
  const editar = (): HTMLButtonElement =>
    elemento(`button[aria-label="Editar tipo de banca ${banca.codigo}"]`);
  const lixeira = (): HTMLButtonElement =>
    elemento(`button[aria-label="Remover tipo de banca ${banca.codigo}"]`);
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-tipo-banca-form"]');
  const confirmar = (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]');
  const dialogo = (): HTMLElement => elemento('cfg-tipo-banca-remocao');
  const botaoDoDialogo = (nome: string): HTMLButtonElement =>
    [...dialogo().querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === nome || botao.getAttribute('aria-label') === nome,
    ) as HTMLButtonElement;
  const statusDaPagina = (): string =>
    elemento(':scope > span.sr-only[role="status"]').textContent ?? '';
  async function abrirEdicao(): Promise<void> {
    editar().focus();
    editar().click();
    await propagar();
    controller.expectOne((r) => r.url === FASES).flush([]);
    await propagar();
  }
  async function enviar() {
    salvar().focus();
    salvar().click();
    await propagar();
    return controller.expectOne(ESCRITA);
  }
  async function confirmarRemocao() {
    lixeira().focus();
    lixeira().click();
    await propagar();
    confirmar().click();
    await propagar();
    return controller.expectOne(ESCRITA);
  }
  async function recarregarCom(itens: readonly TipoBancaDto[]): Promise<void> {
    await propagar();
    controller.expectOne((r) => r.url === LISTA).flush(itens);
    await propagar();
  }

  describe('conflito de idempotência ao salvar', () => {
    it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
      await abrirEdicao();
      const primeira = await enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(409, { code: 'uniplus.idempotency.processing_conflict' }));
      await propagar();
      expect(edicao.erro()).not.toBeNull();
      expect(elemento('ui-drawer ui-alert').textContent).toContain(edicao.erro());
      expect(fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      const segunda = await enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(...sucesso());
      await recarregarCom([banca]);
    });

    it('corpo divergente renova a chave', async () => {
      await abrirEdicao();
      const primeira = await enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(422, { code: 'uniplus.idempotency.body_mismatch' }));
      await propagar();
      const segunda = await enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush(...sucesso());
      await recarregarCom([banca]);
    });

    it('falha de validação do servidor renova a chave', async () => {
      await abrirEdicao();
      const primeira = await enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(
        ...problema(422, {
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'Nome',
              code: 'uniplus.configuracao.tipo_banca.nome_tamanho',
              message: 'Nome longo.',
            },
          ],
        }),
      );
      await propagar();
      edicao.form.controls.nome.setValue('Banca de Entrevista (revisada)');
      const segunda = await enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush(...sucesso());
      await recarregarCom([banca]);
    });
  });

  describe('escrita em curso', () => {
    it('salvar pendente não se apresenta como remoção, e o clique em Salvar nem chega a submeter', async () => {
      await abrirEdicao();
      const requisicao = await enviar();
      expect(edicao.salvando()).toBe(true);
      expect(edicao.removendo()).toBe(false);
      expect(elemento('cfg-tipos-banca-lista').textContent).not.toContain('Removendo');
      let submissoes = 0;
      elemento('#cfg-tipo-banca-form').addEventListener('submit', () => (submissoes += 1));
      salvar().click();
      expect(submissoes).toBe(0);
      requisicao.flush(...sucesso());
      await recarregarCom([banca]);
    });

    it('depois de remover, a espera pela recarga não se apresenta como remoção', async () => {
      (await confirmarRemocao()).flush(...sucesso());
      await propagar();
      expect(edicao.gravando()).toBe(true);
      expect(edicao.removendo()).toBe(false);
      await recarregarCom([]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      edicao.removerConfirmado();
      controller.expectNone(ESCRITA);
    });
  });

  describe('anúncios do salvamento', () => {
    it('anuncia no drawer o andamento e a recusa dos campos, e não repete na página', async () => {
      await abrirEdicao();
      const requisicao = await enviar();
      expect(elemento('ui-drawer [role="status"]').textContent).toContain('Salvando');
      requisicao.flush(
        ...problema(422, {
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'Nome',
              code: 'uniplus.configuracao.tipo_banca.nome_tamanho',
              message: 'Nome longo.',
            },
          ],
        }),
      );
      await propagar();
      expect(elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(statusDaPagina()).toBe('');
    });

    it('falha geral é anunciada só pelo alerta, não pela região de status', async () => {
      await abrirEdicao();
      (await enviar()).flush(...problema(500, { code: 'uniplus.erro' }));
      await propagar();
      expect(elemento('ui-drawer [role="status"]').textContent?.trim()).toBe('');
      expect(elemento('ui-drawer ui-alert').textContent).toContain(edicao.erro());
    });

    it('anuncia na página o desfecho do salvamento depois de o drawer fechar', async () => {
      await abrirEdicao();
      (await enviar()).flush(...sucesso());
      await recarregarCom([banca]);
      expect(statusDaPagina()).toBe('Tipo de banca atualizado.');
      await abrirEdicao();
      expect(statusDaPagina()).toBe('');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await abrirEdicao();
      (await enviar()).flush(...sucesso());
      await propagar();
      expect(edicao.salvando()).toBe(false);
      expect(edicao.gravando()).toBe(true);
      expect(editar().getAttribute('aria-disabled')).toBe('true');
      await recarregarCom([banca]);
      expect(edicao.gravando()).toBe(false);
      expect(editar().getAttribute('aria-disabled')).toBeNull();
    });

    it('libera as ações quando a recarga falha', async () => {
      await abrirEdicao();
      (await enviar()).flush(...sucesso());
      await propagar();
      controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.indisponivel' }));
      await propagar();
      expect(edicao.gravando()).toBe(false);
    });
  });

  describe('foco depois de salvar', () => {
    const campoNome = (): HTMLInputElement => elemento('input[formcontrolname="nome"]');
    const enviarComEnter = async (): Promise<void> => {
      campoNome().focus();
      elemento<HTMLFormElement>('#cfg-tipo-banca-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await propagar();
    };

    it('Enter no campo, com o envio em curso, leva o foco ao botão de salvar', async () => {
      await abrirEdicao();
      await enviarComEnter();
      controller.expectOne(ESCRITA);
      expect(campoNome().matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(salvar());
    });

    it('Enter no campo, com o envio barrado pela validação, mantém o foco no campo', async () => {
      await abrirEdicao();
      edicao.form.controls.nome.setValue('');
      await enviarComEnter();
      controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoNome());
    });

    it('cancelar devolve o foco ao botão que abriu o drawer', async () => {
      await abrirEdicao();
      const cancelar = [...fixture.nativeElement.querySelectorAll('button')].find(
        (botao: HTMLButtonElement) => botao.textContent?.trim() === 'Cancelar',
      ) as HTMLButtonElement;
      cancelar.click();
      await propagar();
      expect(document.activeElement).toBe(editar());
    });

    it('salvar com a linha ainda presente na recarga devolve o foco ao botão da linha', async () => {
      await abrirEdicao();
      (await enviar()).flush(...sucesso());
      await recarregarCom([banca]);
      expect(document.activeElement).toBe(editar());
    });

    it('salvar com a recarga sem a linha leva o foco ao título da lista', async () => {
      await abrirEdicao();
      (await enviar()).flush(...sucesso());
      await recarregarCom([]);
      expect(document.activeElement).toBe(elemento(TITULO_DA_LISTA));
    });

    it('salvar com falha na recarga leva o foco ao título da lista', async () => {
      await abrirEdicao();
      (await enviar()).flush(...sucesso());
      await propagar();
      controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.indisponivel' }));
      await propagar();
      expect(document.activeElement).toBe(elemento(TITULO_DA_LISTA));
    });
  });

  describe('diálogo de remoção', () => {
    it('pendente: o botão mantém o foco, indisponível; Cancelar e X recusados; Esc não fecha', async () => {
      const requisicao = await confirmarRemocao();
      expect(document.activeElement).toBe(confirmar());
      expect(confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(confirmar().getAttribute('aria-busy')).toBe('true');
      expect(botaoDoDialogo('Cancelar').matches(':disabled')).toBe(true);
      expect(botaoDoDialogo('Fechar').matches(':disabled')).toBe(true);
      elemento('cfg-tipo-banca-remocao dialog').dispatchEvent(
        new Event('cancel', { cancelable: true }),
      );
      await propagar();
      expect(edicao.confirmando()).toBe(true);
      expect(elemento('cfg-tipo-banca-remocao [role="status"]').textContent).toContain('Removendo');
      confirmar().click();
      controller.expectNone(ESCRITA);
      requisicao.flush(...sucesso());
      await recarregarCom([]);
    });

    it.each([409, 500])(
      'recusa %s mantém o diálogo aberto com o foco no botão, a mensagem e o botão disponível de novo',
      async (status) => {
        const primeira = await confirmarRemocao();
        primeira.flush(...problema(status, { code: 'uniplus.idempotency.processing_conflict' }));
        await propagar();
        expect(edicao.confirmando()).toBe(true);
        expect(elemento('cfg-tipo-banca-remocao .field__error').textContent).toContain(
          edicao.erroRemocao(),
        );
        expect(elemento('cfg-tipo-banca-remocao [role="status"]').textContent).toContain(
          'Não foi possível remover',
        );
        expect(confirmar().getAttribute('aria-disabled')).toBeNull();
        expect(document.activeElement).toBe(confirmar());
        expect(statusDaPagina()).toBe('');
        confirmar().click();
        await propagar();
        expect(
          fixture.nativeElement.querySelector('cfg-tipo-banca-remocao .field__error'),
        ).toBeNull();
        controller.expectOne(ESCRITA).flush(...sucesso());
        await recarregarCom([]);
      },
    );

    it('remoção concluída com a linha ausente da recarga leva o foco ao título da lista', async () => {
      (await confirmarRemocao()).flush(...sucesso());
      await propagar();
      expect(edicao.gravando()).toBe(true);
      expect(edicao.confirmando()).toBe(false);
      await recarregarCom([]);
      expect(document.activeElement).toBe(elemento(TITULO_DA_LISTA));
      expect(statusDaPagina()).toBe(`Tipo de banca ${banca.codigo} removido.`);
    });

    it('remoção concluída com falha na recarga leva o foco ao título da lista', async () => {
      (await confirmarRemocao()).flush(...sucesso());
      await propagar();
      controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.indisponivel' }));
      await propagar();
      expect(document.activeElement).toBe(elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco à lixeira da linha', async () => {
      lixeira().focus();
      lixeira().click();
      await propagar();
      botaoDoDialogo('Cancelar').click();
      await propagar();
      expect(document.activeElement).toBe(lixeira());
    });
  });
});
