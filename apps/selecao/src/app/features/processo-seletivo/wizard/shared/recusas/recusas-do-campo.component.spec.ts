import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { RecusaOrdenada } from './ordem-das-recusas';
import { RecusasDoCampoComponent } from './recusas-do-campo.component';

function recusa(parcial: Partial<RecusaOrdenada>): RecusaOrdenada {
  return {
    campo: 'fim',
    codigo: 'uniplus.selecao.codigo_a',
    mensagem: 'Mensagem da API.',
    pagina: null,
    ordem: 0,
    resposta: 1,
    origem: 'gravacao',
    aConferir: false,
    ...parcial,
  };
}

function montar(recusas: readonly RecusaOrdenada[]): HTMLElement {
  const fixture = TestBed.createComponent(RecusasDoCampoComponent);
  fixture.componentRef.setInput('recusas', recusas);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('RecusasDoCampoComponent', () => {
  it('mostra a mensagem e o código da recusa ativa, sem nota', () => {
    const tela = montar([recusa({})]);

    expect(tela.textContent).toContain('Mensagem da API.');
    expect(tela.textContent).toContain('uniplus.selecao.codigo_a');
    expect(tela.textContent).not.toContain('Você alterou esta parte');
  });

  it('mantém à vista a recusa a conferir e diz que a gravação vai conferi-la de novo', () => {
    const tela = montar([recusa({ aConferir: true })]);

    expect(tela.textContent).toContain('Mensagem da API.');
    expect(tela.textContent).toContain('conferida de novo na próxima gravação');
  });

  it('diz publicação, e não gravação, quando a recusa veio da publicação', () => {
    const tela = montar([recusa({ aConferir: true, origem: 'publicacao' })]);

    expect(tela.textContent).toContain('conferida de novo na próxima publicação');
    expect(tela.textContent).not.toContain('próxima gravação');
  });

  it('repete a nota uma vez só quando várias recusas estão a conferir', () => {
    const tela = montar([recusa({ aConferir: true }), recusa({ aConferir: true, codigo: 'b' })]);

    expect(tela.textContent?.match(/Você alterou esta parte/g)).toHaveLength(1);
  });

  it('não desenha nada sem recusa', () => {
    expect(montar([]).textContent?.trim()).toBe('');
  });
});
