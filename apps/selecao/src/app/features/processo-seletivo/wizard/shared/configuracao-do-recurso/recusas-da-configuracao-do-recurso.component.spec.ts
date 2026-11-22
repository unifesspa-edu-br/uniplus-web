import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { RecusasDaConfiguracaoDoRecursoComponent } from './recusas-da-configuracao-do-recurso.component';

function recusa(campo: string, mensagem: string, ordem: number, aConferir = false): RecusaOrdenada {
  return {
    campo,
    codigo: `uniplus.selecao.recurso.${campo}`,
    mensagem,
    pagina: `https://developers.unifesspa.edu.br/erros/${campo}`,
    ordem,
    resposta: 1,
    origem: 'gravacao',
    aConferir,
  };
}

function montar(
  recusas: readonly RecusaOrdenada[],
  alvos = vi.fn((_campo: string): string[] => []),
) {
  const fixture = TestBed.createComponent(RecusasDaConfiguracaoDoRecursoComponent);
  fixture.componentRef.setInput('recusas', recusas);
  fixture.componentRef.setInput('alvos', alvos);
  fixture.detectChanges();
  return { fixture, raiz: fixture.nativeElement as HTMLElement, alvos };
}

describe('RecusasDaConfiguracaoDoRecursoComponent', () => {
  it('não desenha nada sem recusa', () => {
    const { raiz } = montar([]);

    expect(raiz.querySelector('ul')).toBeNull();
  });

  it('lista cada recusa na ordem em que a pessoa deve lê-la, com o botão que leva ao campo', () => {
    const { raiz } = montar([
      recusa('guardaDaVaga', 'A guarda não serve.', 2),
      recusa('prazoValor', 'O prazo não serve.', 1),
    ]);

    const itens = Array.from(raiz.querySelectorAll('li'));
    expect(itens.map((item) => item.textContent)).toEqual([
      expect.stringContaining('O prazo não serve.'),
      expect.stringContaining('A guarda não serve.'),
    ]);
    expect(
      itens.every((item) => item.querySelector('button')?.textContent?.trim() === 'Ir ao campo'),
    ).toBe(true);
  });

  describe('"Ir ao campo"', () => {
    afterEach(() => document.getElementById('destino-do-foco')?.remove());

    it('leva o foco ao controle do campo recusado', () => {
      const destino = document.createElement('input');
      destino.id = 'destino-do-foco';
      document.body.append(destino);
      const alvos = vi.fn((_campo: string) => ['inexistente', 'destino-do-foco']);
      const { raiz } = montar([recusa('prazoValor', 'O prazo não serve.', 1)], alvos);

      raiz.querySelector<HTMLButtonElement>('li button')?.click();
      TestBed.inject(ApplicationRef).tick();

      expect(alvos).toHaveBeenCalledWith('prazoValor');
      expect(document.activeElement).toBe(destino);
    });
  });

  it('mantém à vista a recusa que a pessoa já tocou, com a nota de que será conferida de novo', () => {
    const { raiz } = montar([recusa('prazoValor', 'O prazo não serve.', 1, true)]);

    expect(raiz.textContent).toContain('O prazo não serve.');
    expect(raiz.textContent).toContain('conferida de novo na próxima gravação');
  });
});
