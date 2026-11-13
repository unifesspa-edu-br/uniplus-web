import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type DetalheDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDaProtecaoDoCatalogo } from './edicao-da-protecao-do-catalogo';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const detalhe: DetalheDaProtecaoDoCatalogoDto = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: {
    situacao: 'SOLICITADA',
    solicitadaEm: '2026-11-01T12:00:00Z',
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
    ciclo: 1,
    manifestadaEm: null,
    manifestacaoDesfavoravel: false,
  },
  descricao: 'Laudo complementar.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf', tamanhoMaximoMb: 10 },
  manifestacoesVigentes: [],
  atos: [],
};

describe('ProtecaoDoCatalogoPage — escritas pela interface', () => {
  let fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  let edicao: EdicaoDaProtecaoDoCatalogo;
  let store: ProtecaoDoCatalogoStore;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProtecaoDoCatalogoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PermissoesService, useValue: { tem: () => true } },
      ],
    });
    fixture = TestBed.createComponent(ProtecaoDoCatalogoPage);
    edicao = fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo);
    store = fixture.debugElement.injector.get(ProtecaoDoCatalogoStore);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === URL).flush([detalhe]);
    await propagar();
  });

  afterEach(() => {
    controller
      .match((r) => r.url === `${BASE}/api/configuracao/categorias-documento`)
      .forEach((r) => r.flush([]));
    controller.verify();
  });

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }

  function elemento<T extends HTMLElement>(seletor: string): T {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  }

  function botao(seletor: string, texto: string): HTMLButtonElement {
    const el = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(seletor),
    ].find((b) => b.textContent?.trim() === texto);
    expect(el, texto).toBeDefined();
    return el as HTMLButtonElement;
  }

  async function abrirDialogo(): Promise<void> {
    elemento<HTMLButtonElement>(`button[aria-label="Ver o detalhe de ${detalhe.nome}"]`).click();
    await propagar();
    controller.expectOne(`${URL}/tipos-documento/${detalhe.id}`).flush(detalhe);
    await propagar();
    botao('dialog[aria-label^="Detalhe do item"] button', 'Reprovar').click();
    await propagar();
  }

  it('durante a decisão conserva os valores, anuncia o envio e bloqueia fechamento e nova ativação', async () => {
    await abrirDialogo();
    const campo = elemento<HTMLTextAreaElement>('dialog textarea');
    campo.value = 'Falta a base legal.';
    campo.dispatchEvent(new Event('input'));
    const confirmar = botao('ui-dialog dialog button', 'Reprovar item');
    const confirmarNaEdicao = vi.spyOn(edicao, 'confirmarDecisao');
    confirmar.focus();
    confirmar.click();
    const post = controller.expectOne((r) => r.url === URL && r.method === 'POST');
    await propagar();

    expect(edicao.decidindo()).toBe(true);
    expect(campo.matches(':disabled')).toBe(true);
    expect(campo.value).toBe('Falta a base legal.');
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(confirmar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(confirmar);
    expect(elemento('ui-dialog [role="status"]').textContent?.trim()).toBe('Registrando decisão.');
    expect(botao('ui-dialog dialog button', 'Cancelar').disabled).toBe(true);
    const dialogo = elemento<HTMLDialogElement>('ui-dialog dialog');
    const fechar = elemento<HTMLButtonElement>('ui-dialog button[aria-label="Fechar"]');
    expect(fechar.disabled).toBe(true);
    fechar.click();
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    confirmar.click();
    await propagar();
    expect(edicao.decisaoAberta()).toBe(true);
    expect(confirmarNaEdicao).toHaveBeenCalledTimes(1);
    controller.expectNone((r) => r.url === URL && r.method === 'POST');

    post.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === URL && r.method === 'GET').flush([]);
    await propagar();
    expect(edicao.decidindo()).toBe(false);
    expect(edicao.decisaoAberta()).toBe(false);
    expect(edicao.detalheAberto()).toBe(false);
  });

  it('a classe de edição recusa decisões concorrentes e fechamento durante a gravação', async () => {
    await abrirDialogo();
    edicao.justificativa.setValue('Falta a base legal.');
    edicao.confirmarDecisao();
    const post = controller.expectOne((r) => r.url === URL && r.method === 'POST');
    edicao.confirmarDecisao();
    edicao.aprovar();
    edicao.abrirDetalhe(detalhe);
    edicao.fecharDecisao();
    edicao.fecharDetalhe();
    expect(edicao.decisaoEmCurso()).toBe('REPROVAR');
    controller.expectNone(`${URL}/tipos-documento/${detalhe.id}`);
    expect(edicao.decisaoAberta()).toBe(true);
    expect(edicao.detalheAberto()).toBe(true);
    controller.expectNone((r) => r.url === URL && r.method === 'POST');
    post.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === URL && r.method === 'GET').flush([]);
    await propagar();
  });

  it('recusa justificativa vazia e leva o foco ao campo com erro', async () => {
    await abrirDialogo();
    const confirmar = botao('ui-dialog dialog button', 'Reprovar item');
    confirmar.focus();
    confirmar.click();
    await propagar();
    await propagar();

    const campo = elemento<HTMLTextAreaElement>('dialog textarea');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toContain('cfg-justificativa-erro');
    expect(elemento('#cfg-justificativa-erro').textContent).toContain('Informe a justificativa');
    expect(document.activeElement).toBe(campo);
    controller.expectNone((r) => r.url === URL && r.method === 'POST');
  });

  it('leva o foco à justificativa que ultrapassa o limite', async () => {
    await abrirDialogo();
    edicao.justificativa.setValue('a'.repeat(2001));
    await propagar();
    const confirmar = botao('ui-dialog dialog button', 'Reprovar item');
    confirmar.focus();
    confirmar.click();
    await propagar();
    await propagar();

    expect(document.activeElement).toBe(elemento('dialog textarea'));
    expect(elemento('#cfg-justificativa-erro').textContent).toContain('até 2.000');
    controller.expectNone((r) => r.url === URL && r.method === 'POST');
  });

  it('descarta a leitura anterior quando outra consulta é iniciada', async () => {
    store.carregar();
    await propagar();
    const antiga = controller.expectOne((r) => r.url === URL && r.method === 'GET');
    store.carregar();
    await propagar();
    expect(antiga.cancelled).toBe(true);
    controller.expectOne((r) => r.url === URL && r.method === 'GET').flush([]);
    await propagar();
    expect(store.itens()).toEqual([]);
  });
});
