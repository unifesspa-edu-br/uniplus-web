import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosTiposEtapa } from './edicao-dos-tipos-etapa';
import { TiposEtapaPage } from './tipos-etapa.page';
import { TiposEtapaStore } from './tipos-etapa.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-etapa`;
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-etapa`;
const tipo: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  criadoEm: '2026-08-11T00:00:00Z',
};

describe('TiposEtapaPage — escritas pela interface', () => {
  let fixture: ComponentFixture<TiposEtapaPage>;
  let edicao: EdicaoDosTiposEtapa;
  let store: TiposEtapaStore;
  let http: HttpTestingController;
  let app: ApplicationRef;

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  };
  const lista = async (): Promise<void> => {
    http.expectOne((r) => r.url === LISTA).flush([tipo]);
    await propagar();
  };
  const preencher = async (): Promise<void> => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    for (const [nome, valor] of [
      ['codigo', 'NOVA_PROVA'],
      ['nome', 'Nova prova'],
    ]) {
      const campo = elemento<HTMLInputElement>(`input[formcontrolname="${nome}"]`);
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }
  };
  const salvar = (): HTMLButtonElement =>
    elemento<HTMLButtonElement>('button[form="cfg-tipo-etapa-form"]');
  const inativar = async (): Promise<void> => {
    elemento<HTMLButtonElement>('button[aria-label="Inativar tipo de etapa PROVA"]').click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  };
  const recusar = (): void => {
    http
      .expectOne(ESCRITA)
      .flush(
        {
          type: 'about:blank',
          title: 'Dados inválidos',
          status: 422,
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'Nome',
              code: 'uniplus.configuracao.tipo_etapa.nome_invalido',
              message: 'Nome recusado.',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
  };
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TiposEtapaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposEtapaPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposEtapa);
    store = fixture.debugElement.injector.get(TiposEtapaStore);
    http = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await lista();
  });
  afterEach(() => http.verify());

  it('mantém formulário somente leitura, foco e drawer aberto durante envio', async () => {
    const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    acionador.focus();
    await preencher();
    const botao = salvar();
    botao.focus();
    botao.click();
    const post = http.expectOne(ESCRITA);
    await propagar();
    const codigo = elemento<HTMLInputElement>('input[formcontrolname="codigo"]');
    expect(codigo.matches(':disabled')).toBe(true);
    expect(codigo.value).toBe('NOVA_PROVA');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(botao);
    const dialog = elemento<HTMLDialogElement>('dialog[aria-label="Formulário de tipo de etapa"]');
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    const botoes = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.form-drawer__footer button',
      ),
    ];
    expect(botoes.find((b) => b.textContent?.trim() === 'Cancelar')?.disabled).toBe(true);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await propagar();
    expect(edicao.formOpen()).toBe(false);
    expect(document.activeElement).toBe(acionador);
    await lista();
  });
  it('recusa clique e submissão repetidos enquanto salva', async () => {
    const espiao = vi.spyOn(edicao, 'salvar');
    await preencher();
    salvar().click();
    const post = http.expectOne(ESCRITA);
    await propagar();
    salvar().click();
    elemento<HTMLFormElement>('#cfg-tipo-etapa-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(espiao).toHaveBeenCalledTimes(1);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await lista();
  });
  it('mostra a recusa no campo e move o foco para ele', async () => {
    await preencher();
    salvar().focus();
    salvar().click();
    await propagar();
    recusar();
    await propagar();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(nome.closest('label')?.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Nome recusado.',
    );
    expect(document.activeElement).toBe(nome);
  });
  for (const sucesso of [true, false]) {
    it(`preserva controle desabilitado após ${sucesso ? 'sucesso' : 'recusa'}`, async () => {
      await preencher();
      edicao.form.controls.descricao.disable();
      salvar().click();
      expect(edicao.form.controls.descricao.disabled).toBe(true);
      expect(edicao.form.controls.nome.enabled).toBe(true);
      if (sucesso) http.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      else recusar();
      await propagar();
      expect(edicao.form.controls.descricao.disabled).toBe(true);
      expect(edicao.form.controls.nome.enabled).toBe(true);
      if (sucesso) await lista();
    });
  }
  it('anuncia inativação e recusa acionadores durante ela e a recarga', async () => {
    await inativar();
    const remocao = http.expectOne(`${ESCRITA}/${tipo.id}`);
    expect(edicao.saving()).toBe(false);
    expect(edicao.removendo()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Inativando...');
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe(
      'Inativando o tipo de etapa PROVA.',
    );
    for (const seletor of [
      '.panel-head .btn--primary',
      'button[aria-label="Editar tipo de etapa PROVA"]',
      'button[aria-label="Inativar tipo de etapa PROVA"]',
    ]) {
      const botao = elemento<HTMLButtonElement>(seletor);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      botao.click();
    }
    expect(edicao.formOpen()).toBe(false);
    expect(edicao.confirmOpen()).toBe(false);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe('Tipo de etapa PROVA inativado.');
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    expect(edicao.formOpen()).toBe(false);
    await lista();
    expect(edicao.gravando()).toBe(false);
  });
  it('recusa tentar novamente durante inativação com falha da lista', async () => {
    await inativar();
    const remocao = http.expectOne(`${ESCRITA}/${tipo.id}`);
    store.recarregar();
    await propagar();
    http
      .expectOne((r) => r.url === LISTA)
      .flush({ title: 'Falha', status: 503 }, { status: 503, statusText: 'Erro' });
    await propagar();
    const botao = elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    botao.click();
    await propagar();
    http.expectNone((r) => r.url === LISTA);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
  });
  it('bloqueia chamadas concorrentes entre salvar e inativar', async () => {
    await preencher();
    edicao.salvar();
    edicao.salvar();
    edicao.pedirRemocao(tipo);
    edicao.removerConfirmado();
    http.expectNone(`${ESCRITA}/${tipo.id}`);
    http.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    edicao.abrirCadastro();
    edicao.salvar();
    http.expectNone(ESCRITA);
    await lista();
    edicao.pedirRemocao(tipo);
    edicao.removerConfirmado();
    edicao.salvar();
    http.expectNone(ESCRITA);
    http.expectOne(`${ESCRITA}/${tipo.id}`).flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
  });
});
