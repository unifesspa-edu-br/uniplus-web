import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { ativa } from './concessoes.page.testing';
import { ConcessoesListaComponent } from './concessoes-lista.component';
import { TIPO_DE_ORIGEM } from './testes';

function montar(concessao: ConcessaoDto): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ConcessoesListaComponent);
  fixture.componentRef.setInput('concessoes', [concessao]);
  fixture.componentRef.setInput('carregando', false);
  fixture.componentRef.setInput('gravando', false);
  fixture.componentRef.setInput('erro', null);
  fixture.componentRef.setInput('situacao', 'todas');
  fixture.componentRef.setInput('nomeDoEscopo', () => 'CEPS');
  fixture.componentRef.setInput('temAnterior', false);
  fixture.componentRef.setInput('temProximo', false);
  fixture.componentRef.setInput('podeRevogar', false);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ConcessoesListaComponent — origem da concessão', () => {
  it('leva ao pedido quando a concessão nasceu de um pedido', () => {
    const host = montar({ ...ativa, origem: { tipo: TIPO_DE_ORIGEM.PEDIDO, id: 'pedido-9' } });

    expect(host.querySelector('a[href="/acessos/pedidos/pedido-9"]')).not.toBeNull();
  });

  it('não oferece o pedido quando a concessão nasceu de uma instalação', () => {
    const host = montar({ ...ativa, origem: { tipo: TIPO_DE_ORIGEM.INSTALACAO, id: 'inst-1' } });

    expect(host.querySelector('a[href^="/acessos/pedidos/"]')).toBeNull();
  });
});
