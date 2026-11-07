import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RespostaExibidaComponent } from './resposta-exibida.component';
import type { ValorExibido } from './valor-da-resposta';

async function montar(exibido: ValorExibido): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(RespostaExibidaComponent);
  fixture.componentRef.setInput('exibido', exibido);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('RespostaExibidaComponent', () => {
  it('o endereço sai uma linha por trecho', async () => {
    const tela = await montar({ linhas: ['Folha 31, 10', 'Marabá/PA'] });

    expect(Array.from(tela.querySelectorAll('.resposta__linha')).map((l) => l.textContent)).toEqual(
      ['Folha 31, 10', 'Marabá/PA'],
    );
  });

  it('a situação conhecida sai em etiqueta, pelo rótulo e não pelo código', async () => {
    const tela = await montar({ situacao: 'submetida' });

    expect(tela.querySelector('ui-tag')?.textContent?.trim()).toBe('Enviada');
    expect(tela.textContent).not.toContain('submetida');
  });

  it('o valor comum passa pela apresentação do valor: booleano em Sim/Não e vazio como não informado', async () => {
    expect((await montar({ valor: true })).textContent?.trim()).toBe('Sim');
    TestBed.resetTestingModule();
    expect((await montar({ valor: null })).textContent?.trim()).toBe('Não informado');
  });
});
