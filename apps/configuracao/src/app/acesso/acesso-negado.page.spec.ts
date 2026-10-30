import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { EU, ok, pedido } from '../features/acessos/testes';
import { AcessoNegadoPage } from './acesso-negado.page';

describe('AcessoNegadoPage', () => {
  const api = { listar: vi.fn() };

  beforeEach(() => {
    api.listar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PedidosDeConcessaoApi, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { rotaDeVolta: '/acessos/pedidos/novo', rotuloDaRotaDeVolta: 'Pedir acesso' },
            },
          },
        },
        { provide: AuthService, useValue: { logout: vi.fn() } },
        { provide: UserContextService, useValue: { user: signal(EU).asReadonly() } },
      ],
    });
  });

  function abrir() {
    const fixture = TestBed.createComponent(AcessoNegadoPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra o pedido que espera o aceite do beneficiário, com a ação de aceitar', () => {
    api.listar.mockReturnValue(
      of(
        ok([
          pedido({
            id: 'pedido-aceite',
            situacao: 'aguardando_beneficiario',
            beneficiario: {
              email: EU.email,
              identidade: { emissor: 'unifesspa', sub: EU.id },
              nome: EU.nomeCivil,
            },
          }),
          pedido({ id: 'pedido-antigo', situacao: 'recusado' }),
        ]),
      ),
    );

    const host = abrir();

    expect(api.listar).toHaveBeenCalledWith({ fila: 'meus', situacao: 'aguardando_beneficiario' });
    expect(host.querySelectorAll('a[href="/acessos/pedidos/pedido-aceite"]')).toHaveLength(1);
    expect(host.textContent).toContain('Aguardando o aceite do beneficiário');
    const aceitar = host.querySelector('a[href="/acessos/pedidos/pedido-aceite"]');
    expect(aceitar?.textContent?.trim()).toBe('Aceitar o pedido');
    expect(aceitar?.classList).toContain('btn--primary');
    expect(host.querySelector('a[href="/acessos/pedidos/pedido-antigo"]')).toBeNull();
    expect(host.querySelector('a[href="/acessos/pedidos"]')?.textContent).toContain('Meus pedidos');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')?.classList).not.toContain(
      'btn--primary',
    );
  });

  it('para o pedido que aguarda o documento, a ação primária é anexá-lo', () => {
    api.listar.mockReturnValue(
      of(ok([pedido({ id: 'pedido-doc', situacao: 'aguardando_documento', etapaAtual: null })])),
    );

    const host = abrir();

    expect(api.listar).toHaveBeenCalledWith({ fila: 'meus', situacao: 'aguardando_documento' });
    const anexar = host.querySelector('a[href="/acessos/pedidos/pedido-doc"]');
    expect(anexar?.textContent?.trim()).toBe('Anexar o documento');
    expect(anexar?.classList).toContain('btn--primary');
    expect(host.textContent).toContain('Aguardando o documento de designação');
  });

  it('sem pedido em aberto mantém o acesso negado com o link para pedir perfil', () => {
    api.listar.mockReturnValue(of(ok([pedido({ situacao: 'aprovado' })])));

    const host = abrir();

    expect(host.textContent).not.toContain('pedidos de acesso em aberto');
    expect(host.querySelector('a[href="/acessos/pedidos/novo"]')).not.toBeNull();
  });
});
