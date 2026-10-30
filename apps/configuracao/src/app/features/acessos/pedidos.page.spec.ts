import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { PedidosPage } from './pedidos.page';
import { ok, pedido, recusa, UNIDADES } from './testes';

describe('PedidosPage', () => {
  const api = { listar: vi.fn() };

  beforeEach(() => {
    api.listar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PedidosDeConcessaoApi, useValue: api },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
  });

  function abrir(fila: 'meus' | 'gestor' | 'protecao_de_dados' | 'todos') {
    const fixture = TestBed.createComponent(PedidosPage);
    fixture.componentRef.setInput('fila', fila);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('lista os pedidos de quem pergunta, com o escopo nomeado e o pedido de acesso à vista', () => {
    api.listar.mockReturnValue(of(ok([{ ...pedido(), situacao: 'aguardando_gestor' }])));

    const { host } = abrir('meus');

    expect(api.listar.mock.calls[0]?.[0]).toMatchObject({ fila: 'meus' });
    expect(host.querySelector('h1')?.textContent).toContain('Meus pedidos de acesso');
    expect(host.textContent).toContain('Betina Teste');
    expect(host.textContent).toContain('CEPS');
    expect(host.textContent).toContain('Aguardando o gestor de acessos');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).not.toBeNull();
  });

  it('pede a fila da etapa e não oferece o pedido de acesso nem o filtro de situação', () => {
    api.listar.mockReturnValue(of(ok([])));

    const { host } = abrir('protecao_de_dados');

    expect(api.listar.mock.calls[0]?.[0]).toMatchObject({ fila: 'protecao_de_dados' });
    expect(host.querySelector('h1')?.textContent).toContain('Fila da proteção de dados');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).toBeNull();
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).toContain('Nenhum pedido aguarda a sua aprovação.');
  });

  it('filtra pela situação escolhida', () => {
    api.listar.mockReturnValue(of(ok([])));
    const { fixture, host } = abrir('meus');
    const select = host.querySelector('select') as HTMLSelectElement;

    select.value = 'aprovado';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: 'aprovado' }));
  });

  it('lista o histórico em qualquer situação e filtra pela situação escolhida', () => {
    api.listar.mockReturnValue(of(ok([{ ...pedido(), situacao: 'recusado' }])));
    const { fixture, host } = abrir('todos');
    const select = host.querySelector('select') as HTMLSelectElement;

    expect(api.listar.mock.calls[0]?.[0]).toMatchObject({ fila: 'todos', situacao: undefined });
    expect(host.querySelector('h1')?.textContent).toContain('Histórico de pedidos');
    expect(host.textContent).toContain('Recusado');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).toBeNull();

    select.value = 'recusado';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(api.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ fila: 'todos', situacao: 'recusado' }),
    );
  });

  it('abre o detalhe com o clique na linha e com o Enter, levando a origem da fila', () => {
    api.listar.mockReturnValue(of(ok([{ ...pedido(), situacao: 'recusado' }])));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { host } = abrir('todos');
    const linha = host.querySelector('tbody tr') as HTMLElement;

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

  it('não abre a linha pelo clique no ícone de ações, que navega por conta própria', () => {
    api.listar.mockReturnValue(of(ok([pedido()])));
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const { host } = abrir('meus');

    (host.querySelector('td.table-responsive__actions a') as HTMLElement).click();

    expect(navegar).not.toHaveBeenCalled();
  });

  it('mostra a recusa da API com a nova tentativa', () => {
    api.listar.mockReturnValue(of(recusa('uniplus.x', 403, 'Sem permissão para a fila')));

    const { host } = abrir('gestor');

    expect(host.textContent).toContain('Sem permissão para a fila');
    expect(host.textContent).toContain('Tentar novamente');
  });
});
