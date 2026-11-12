import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { PedidosPage } from './pedidos.page';
import { PedidosStore } from './pedidos.store';
import { ok, pedido, UNIDADES } from './testes';

const URL = 'http://api.test/api/autorizacao/pedidos-de-concessao';

describe('PedidosPage', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function atualizar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  }

  it('lista a fila informada e filtra pela situação', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.componentRef.setInput('fila', 'todos');
    fixture.detectChanges();
    const store = fixture.debugElement.injector.get(PedidosStore);
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('fila')).toBe('todos');
    req.flush([pedido()]);
    await atualizar();
    expect(store.itens()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Betina Teste');
    store.filtrarPor('recusado');
    await atualizar();
    const filtro = http.expectOne((r) => r.url === URL);
    expect(filtro.request.params.get('situacao')).toBe('recusado');
    filtro.flush([]);
    await atualizar();
    expect(store.itens()).toHaveLength(0);
  });

  const falhar = (
    status: number,
    title: string,
    requisicao = http.expectOne((r) => r.url === URL),
  ): void => {
    requisicao.flush(
      { title, status, code: 'uniplus.x', type: 'about:blank', traceId: '' },
      {
        status,
        statusText: 'Erro',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
  };

  it('a falha do servidor permite tentar novamente, com o botão indisponível e focado durante a carga e o foco no título depois', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    const host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    fixture.detectChanges();
    falhar(503, 'Servidor indisponível');
    await atualizar();
    expect(host.textContent).toContain('Servidor indisponível');
    const tentar = host.querySelector<HTMLButtonElement>('ui-alert button');
    expect(tentar?.getAttribute('aria-disabled')).toBeNull();

    tentar?.focus();
    tentar?.click();
    await atualizar();
    expect(tentar?.getAttribute('aria-disabled')).toBe('true');
    expect(tentar?.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(tentar);
    tentar?.click();
    await atualizar();
    const nova = http.expectOne((r) => r.url === URL);
    nova.flush([]);
    await atualizar();
    await atualizar();

    expect(host.querySelector('ui-alert')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('#cfg-pedidos-titulo'));
    host.remove();
  });

  it('a recusa por falta de permissão mostra o motivo sem oferecer nova tentativa', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    const host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    falhar(403, 'Sem permissão para a fila');
    await atualizar();

    expect(host.textContent).toContain('Sem permissão para a fila');
    expect(host.querySelector('ui-alert button')).toBeNull();
    expect(host.textContent).not.toContain('Tentar novamente');
  });

  it('a nova tentativa relê a página que falhou, e não a primeira', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    const host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === URL)
      .flush([pedido()], { headers: { Link: '</pedidos?cursor=proximo>; rel="next"' } });
    await atualizar();
    fixture.debugElement.injector.get(PedidosStore).proximaPagina();
    await atualizar();
    const segunda = http.expectOne((r) => r.url === URL);
    expect(segunda.request.params.get('cursor')).toBe('proximo');
    falhar(503, 'Servidor indisponível', segunda);
    await atualizar();

    host.querySelector<HTMLButtonElement>('ui-alert button')?.click();
    await atualizar();

    const nova = http.expectOne((r) => r.url === URL);
    expect(nova.request.params.get('cursor')).toBe('proximo');
    nova.flush([]);
  });

  it('lista os próprios pedidos com escopo, situação e acesso ao cadastro', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.componentRef.setInput('fila', 'meus');
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('fila')).toBe('meus');
    req.flush([pedido({ situacao: 'aguardando_gestor' })]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain('Meus pedidos de acesso');
    expect(host.textContent).toContain('Betina Teste');
    expect(host.textContent).toContain('CEPS');
    expect(host.textContent).toContain('Aguardando a gestão de acessos');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).not.toBeNull();
  });

  it('apresenta a fila do Representante do controlador sem cadastro nem filtro', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.componentRef.setInput('fila', 'protecao_de_dados');
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('fila')).toBe('protecao_de_dados');
    req.flush([]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain('Fila do Representante do controlador');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).toBeNull();
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).toContain('Nenhum pedido aguarda a sua aprovação.');
  });

  it('filtra os próprios pedidos pela situação escolhida na interface', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([]);
    await atualizar();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'aprovado';
    select.dispatchEvent(new Event('change'));
    await atualizar();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao')).toBe('aprovado');
    req.flush([]);
    await atualizar();
  });

  it('apresenta o histórico em qualquer situação e filtra pela situação escolhida', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.componentRef.setInput('fila', 'todos');
    fixture.detectChanges();
    const inicial = http.expectOne((r) => r.url === URL);
    expect(inicial.request.params.get('fila')).toBe('todos');
    expect(inicial.request.params.has('situacao')).toBe(false);
    inicial.flush([pedido({ situacao: 'recusado' })]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toContain('Histórico de pedidos');
    expect(host.textContent).toContain('Recusado');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).toBeNull();
    const select = host.querySelector('select') as HTMLSelectElement;
    select.value = 'recusado';
    select.dispatchEvent(new Event('change'));
    await atualizar();
    const filtro = http.expectOne((r) => r.url === URL);
    expect(filtro.request.params.get('fila')).toBe('todos');
    expect(filtro.request.params.get('situacao')).toBe('recusado');
    filtro.flush([]);
    await atualizar();
  });

  it('abre o detalhe por clique e Enter, informando a origem', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.componentRef.setInput('fila', 'todos');
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([pedido({ situacao: 'recusado' })]);
    await atualizar();
    const linha = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(linha.getAttribute('tabindex')).toBe('0');
    linha.click();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    linha.dispatchEvent(enter);
    expect(navegar).toHaveBeenCalledTimes(2);
    expect(navegar).toHaveBeenLastCalledWith(['/acessos/pedidos', 'pedido-1'], {
      queryParams: { origem: 'todos' },
    });
    expect(enter.defaultPrevented).toBe(true);
  });

  it('não abre a linha pelo clique no ícone de ações', async () => {
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([pedido()]);
    await atualizar();
    (fixture.nativeElement.querySelector('td.table-responsive__actions a') as HTMLElement).click();
    expect(navegar).not.toHaveBeenCalled();
  });

  it.each([
    ['meus', null],
    ['gestor', { origem: 'gestor' }],
  ] as const)('abre o pedido da fila %s levando a origem', async (fila, query) => {
    const fixture = TestBed.createComponent(PedidosPage);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentRef.setInput('fila', fila);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([pedido()]);
    await atualizar();

    (fixture.nativeElement.querySelector('tbody tr') as HTMLElement).click();

    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos', 'pedido-1'], { queryParams: query });
  });

  it('nomeia o escopo da unidade pela sigla e o da instituição sem unidade', async () => {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === URL)
      .flush([
        pedido(),
        pedido({ id: 'pedido-2', escopo: { tipo: 'instituicao', unidadeId: null } }),
      ]);
    await atualizar();

    const escopos = [...fixture.nativeElement.querySelectorAll('td[data-label="Escopo"]')].map(
      (celula) => celula.textContent.trim(),
    );
    expect(escopos).toEqual(['CEPS', 'Instituição']);
  });
});
