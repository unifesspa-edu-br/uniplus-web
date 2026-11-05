import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TiposBancaPage } from './tipos-banca.page';
import { TiposBancaStore } from './tipos-banca.store';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';

const BASE = 'http://localhost:5000';
const CRIAR_URL = `${BASE}/api/configuracao/admin/tipos-banca`;
const FASES_URL = `${BASE}/api/configuracao/fases-canonicas`;

const bancaSeed: TipoBancaDto = {
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: 'BANCA_ENTREVISTA',
  nome: 'Banca de Entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('TiposBancaPage — escritas', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let store: TiposBancaStore;
  let edicao: EdicaoDosTiposBanca;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
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
    store = fixture.debugElement.injector.get(TiposBancaStore);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposBanca);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    // A tela nunca deve emitir a criação de tipo de banca.
    controller.expectNone((r) => r.method === 'POST' && r.url === CRIAR_URL);
    controller.verify();
  });

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly TipoBancaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-banca`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  // Abrir a edição dispara o carregamento lazy das sugestões de "Fase típica"
  // (um GET por cursor a fases-canonicas). O `httpResource` só emite a request
  // após um tick.
  async function abrirEdicao(banca: TipoBancaDto): Promise<void> {
    edicao.abrirEdicao(banca);
    await propagate();
    controller.expectOne((r) => r.url === FASES_URL).flush([]);
    await propagate();
  }

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    for (const campo of ['codigo', 'nome']) {
      const controle = (fixture.nativeElement as HTMLElement).querySelector(`[formcontrolname="${campo}"]`);
      expect(controle?.getAttribute('aria-required')).toBe('true');
    }
  });

  it('CA-07: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    expect(edicao.form.controls.codigo.value).toBe('BANCA_ENTREVISTA');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    edicao.form.controls.nome.setValue('Banca de Entrevista (revisada)');
    edicao.salvar();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: bancaSeed.id,
      nome: 'Banca de Entrevista (revisada)',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
  });

  it('CA-08/CA-14: salvar a edição emite PUT e nunca POST', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    edicao.form.controls.nome.setValue('Banca de Entrevista (2)');
    edicao.salvar();

    controller.expectNone(CRIAR_URL);
    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
  });

  it('CA-14: "Fase típica" aceita texto livre não vinculado ao cadastro de fases e viaja no PUT', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);

    edicao.form.controls.faseTipica.setValue('Uma fase qualquer sem correspondência');
    edicao.salvar();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    expect(put.request.body).toMatchObject({ faseTipica: 'Uma fase qualquer sem correspondência' });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
  });

  it('mantém o formulário e a abertura bloqueados durante o envio', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    fixture.detectChanges();
    edicao.form.controls.descricao.disable();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('#cfg-tipo-banca-form') as HTMLFormElement;
    const nome = form.querySelector('[formcontrolname="nome"]') as HTMLInputElement;
    const salvar = fixture.nativeElement.querySelector(
      'button[form="cfg-tipo-banca-form"]',
    ) as HTMLButtonElement;
    const salvarDaClasse = vi.spyOn(edicao, 'salvar');
    salvar.focus();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const requisicao = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );
    await propagate();
    fixture.detectChanges();
    expect(nome.matches(':disabled')).toBe(true);
    expect(nome.value).toBe(bancaSeed.nome);
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(salvar);
    salvar.click();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    expect(salvarDaClasse).toHaveBeenCalledTimes(1);
    const cancelar = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((botao) => botao.textContent?.trim() === 'Cancelar');
    expect(cancelar?.disabled).toBe(true);
    const fechar = fixture.nativeElement.querySelector(
      'ui-drawer button[aria-label="Fechar"]',
    ) as HTMLButtonElement;
    expect(fechar.disabled).toBe(true);
    const dialogo = fixture.nativeElement.querySelector('ui-drawer dialog') as HTMLDialogElement;
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(edicao.aberto()).toBe(true);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
    expect(edicao.aberto()).toBe(false);
    expect(edicao.form.controls.descricao.disabled).toBe(true);
  });

  it('anuncia a remoção e desabilita as ações enquanto aguarda', async () => {
    await flushLista([bancaSeed]);
    edicao.pedirRemocao(bancaSeed);
    edicao.removerConfirmado();
    const requisicao = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );
    await propagate();
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('Removendo o tipo de banca BANCA_ENTREVISTA');
    expect(edicao.salvando()).toBe(false);
    expect(
      (
        fixture.nativeElement.querySelector(
          'button[aria-label="Editar tipo de banca BANCA_ENTREVISTA"]',
        ) as HTMLButtonElement
      ).getAttribute('aria-disabled'),
    ).toBe('true');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    fixture.detectChanges();
    expect(status.textContent).toContain('Tipo de banca BANCA_ENTREVISTA removido');
  });
  it('apresenta a recusa no campo e preserva controle desabilitado', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    edicao.form.controls.descricao.disable();
    fixture.detectChanges();
    const salvar = fixture.nativeElement.querySelector(
      'button[form="cfg-tipo-banca-form"]',
    ) as HTMLButtonElement;
    salvar.focus();
    salvar.click();
    const requisicao = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );
    await propagate();
    requisicao.flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.tipo_banca.invalido',
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
    await propagate();
    fixture.detectChanges();
    await propagate();
    const nome = fixture.nativeElement.querySelector(
      '[formcontrolname="nome"]',
    ) as HTMLInputElement;
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(nome);
    expect(
      (
        fixture.nativeElement.querySelector('[formcontrolname="descricao"]') as HTMLTextAreaElement
      ).matches(':disabled'),
    ).toBe(true);
  });
  it('impede escritas concorrentes de tipos diferentes', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    edicao.pedirRemocao(bancaSeed);
    edicao.salvar();
    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    edicao.salvar();
    edicao.removerConfirmado();
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
    edicao.pedirRemocao(bancaSeed);
    edicao.removerConfirmado();
    const exclusao = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );
    edicao.salvar();
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    exclusao.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });
  it('desabilita nova tentativa de listagem durante remoção', async () => {
    await flushLista([bancaSeed]);
    edicao.pedirRemocao(bancaSeed);
    edicao.removerConfirmado();
    const remocao = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );
    store.recarregar();
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-banca`)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await propagate();
    fixture.detectChanges();
    const tentar = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Tentar novamente',
    );
    expect(tentar?.disabled).toBe(true);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });

  it('devolve o foco ao acionador após salvar', async () => {
    await flushLista([bancaSeed]);
    fixture.detectChanges();
    const editar = fixture.nativeElement.querySelector(
      'button[aria-label="Editar tipo de banca BANCA_ENTREVISTA"]',
    ) as HTMLButtonElement;
    editar.focus();
    editar.click();
    await propagate();
    controller.expectOne((r) => r.url === FASES_URL).flush([]);
    await propagate();
    const salvar = fixture.nativeElement.querySelector(
      'button[form="cfg-tipo-banca-form"]',
    ) as HTMLButtonElement;
    salvar.focus();
    salvar.click();
    controller
      .expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await propagate();
    expect(document.activeElement).toBe(editar);
    await flushLista([bancaSeed]);
  });
});
