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
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-banca/b2`;
const TITULO_DA_LISTA = '#cfg-tipos-banca-list-title';
const banca: TipoBancaDto = {
  id: 'b2',
  codigo: {
    codigo: 'BANCA_ENTREVISTA' as TipoBancaDto['codigo']['codigo'],
    rotulo: 'BANCA_ENTREVISTA',
  },
  nome: 'Banca de Entrevista',
  faseTipica: null,
  descricao: null,
  papel: {
    codigo: 'AVALIA_O_MERITO' as TipoBancaDto['papel']['codigo'],
    rotulo: 'Avalia o mérito',
  },
  exigeDuasOuMaisBancas: false,
  encerraRecursoNaPrimeiraInstancia: false,
  tiposDeDecisaoJulgados: [],
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
  const lixeira = (): HTMLButtonElement =>
    elemento(`button[aria-label="Remover tipo de banca ${banca.codigo.rotulo}"]`);
  const confirmar = (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]');
  const dialogo = (): HTMLElement => elemento('cfg-confirmacao-de-remocao');
  const botaoDoDialogo = (nome: string): HTMLButtonElement =>
    [...dialogo().querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === nome || botao.getAttribute('aria-label') === nome,
    ) as HTMLButtonElement;
  const statusDaPagina = (): string =>
    elemento(':scope > span.sr-only[role="status"]').textContent ?? '';
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

  describe('diálogo de remoção', () => {
    it('pendente: o botão mantém o foco, indisponível; Cancelar e X recusados; Esc não fecha', async () => {
      const requisicao = await confirmarRemocao();
      expect(document.activeElement).toBe(confirmar());
      expect(confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(confirmar().getAttribute('aria-busy')).toBe('true');
      expect(botaoDoDialogo('Cancelar').matches(':disabled')).toBe(true);
      expect(botaoDoDialogo('Fechar').matches(':disabled')).toBe(true);
      elemento('cfg-confirmacao-de-remocao dialog').dispatchEvent(
        new Event('cancel', { cancelable: true }),
      );
      await propagar();
      expect(edicao.confirmando()).toBe(true);
      expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo',
      );
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
        expect(elemento('cfg-confirmacao-de-remocao .field__error').textContent).toContain(
          edicao.erroRemocao(),
        );
        expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
          'Não foi possível remover',
        );
        expect(confirmar().getAttribute('aria-disabled')).toBeNull();
        expect(document.activeElement).toBe(confirmar());
        expect(statusDaPagina()).toBe('');
        confirmar().click();
        await propagar();
        expect(
          fixture.nativeElement.querySelector('cfg-confirmacao-de-remocao .field__error'),
        ).toBeNull();
        controller.expectOne(ESCRITA).flush(...sucesso());
        await recarregarCom([]);
        expect(document.activeElement).toBe(elemento(TITULO_DA_LISTA));
      },
    );

    it('remoção concluída com a linha ausente da recarga leva o foco ao título da lista', async () => {
      (await confirmarRemocao()).flush(...sucesso());
      await propagar();
      expect(edicao.gravando()).toBe(true);
      expect(edicao.confirmando()).toBe(false);
      await recarregarCom([]);
      expect(document.activeElement).toBe(elemento(TITULO_DA_LISTA));
      expect(statusDaPagina()).toBe(`Tipo de banca ${banca.codigo.rotulo} removido.`);
    });

    it('remoção concluída com falha na recarga leva o foco ao título da lista', async () => {
      (await confirmarRemocao()).flush(...sucesso());
      await propagar();
      controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
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
