import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BancaDeclarada } from '../../modelos/banca.models';
import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { umaBancaDeclarada } from './banca-declarada.testing';
import { ListaDeBancasComponent } from './lista-de-bancas.component';

describe('ListaDeBancasComponent', () => {
  let fixture: ComponentFixture<ListaDeBancasComponent>;
  let bancas: readonly BancaDeclarada[];
  const raiz = () => fixture.nativeElement as HTMLElement;
  const botao = (nome: string) =>
    raiz().querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`);
  const atualizar = (novas: readonly BancaDeclarada[]) => {
    bancas = novas;
    fixture.componentRef.setInput('bancas', novas);
    fixture.detectChanges();
  };
  const acrescentar = () => {
    const select = raiz().querySelector('select');
    if (!select) throw new Error('Seletor ausente');
    select.value = 'entrevista';
    select.dispatchEvent(new Event('change'));
    Array.from(raiz().querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Acrescentar'))
      ?.click();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ListaDeBancasComponent] }).compileComponents();
    fixture = TestBed.createComponent(ListaDeBancasComponent);
    fixture.componentRef.setInput('idBase', 'bancas');
    fixture.componentRef.setInput('tipos', [{ id: 'entrevista', rotulo: 'Banca de entrevista' }]);
    fixture.componentInstance.bancasChange.subscribe(atualizar);
    atualizar([]);
    document.body.appendChild(raiz());
  });

  it('pede o tipo junto ao seletor e leva o foco a ele', async () => {
    vi.useFakeTimers();
    raiz().querySelector('button')?.click();
    fixture.detectChanges();
    vi.runAllTimers();
    expect(raiz().querySelector('select')?.getAttribute('aria-describedby')).toBe(
      'bancas-tipo-erro',
    );
    expect(document.activeElement).toBe(raiz().querySelector('select'));
    vi.useRealTimers();
  });

  it('acrescenta, move e retira com anúncio e foco', () => {
    vi.useFakeTimers();
    acrescentar();
    vi.runAllTimers();
    expect(raiz().querySelector('[role=status]')?.textContent).toContain(
      'Banca de entrevista 1 acrescentada.',
    );
    expect(document.activeElement?.id).toBe('bancas-banca-1');
    expect(raiz().querySelector('[aria-label^="Mover"]')).toBeNull();
    acrescentar();
    botao('Mover para antes: Banca de entrevista 2, antes da Banca de entrevista 1')?.click();
    vi.runAllTimers();
    fixture.detectChanges();
    expect(bancas[0].identificadorLocal).toBe('banca-2');
    expect(document.activeElement?.id).toBe('bancas-banca-2');
    expect(raiz().querySelector('[role=status]')?.textContent).toContain(
      'A banca movida passou a ser a Banca de entrevista 1.',
    );
    botao('Retirar a Banca de entrevista 1')?.click();
    vi.runAllTimers();
    fixture.detectChanges();
    expect(document.activeElement?.id).toBe('bancas-banca-1');
    expect(raiz().querySelector('[role=status]')?.textContent).toContain(
      'Banca de entrevista 1 retirada; as seguintes deste tipo mudaram de número.',
    );
    botao('Retirar a Banca de entrevista 1')?.click();
    vi.runAllTimers();
    expect(document.activeElement).toBe(raiz().querySelector('select'));
    vi.useRealTimers();
  });

  it('liga os botões ao aviso de ordem e não apresenta violações axe', async () => {
    acrescentar();
    acrescentar();
    const mover = botao('Mover para antes: Banca de entrevista 2, antes da Banca de entrevista 1');
    expect(mover?.getAttribute('aria-describedby')).toBe('bancas-ordem-entrevista');
    expect((await axe.run(raiz())).violations).toEqual([]);
  });

  it('dá a cada botão um nome acessível que começa pelo texto visível (WCAG 2.5.3)', () => {
    acrescentar();
    acrescentar();
    acrescentar();
    const botoes = Array.from(raiz().querySelectorAll<HTMLButtonElement>('button[aria-label]'));
    const visiveis = botoes.map((botao) => botao.textContent?.trim() ?? '');

    expect(visiveis).toContain('Mover para antes');
    expect(visiveis).toContain('Mover para depois');
    botoes.forEach((botao, indice) => {
      expect(botao.getAttribute('aria-label')?.startsWith(visiveis[indice])).toBe(true);
    });
    expect(
      botao('Mover para depois: Banca de entrevista 2, depois da Banca de entrevista 3'),
    ).not.toBeNull();
  });

  describe('recusas', () => {
    const recusa = (campo: string, mensagem: string, nota?: string): RecusaOrdenada => ({
      campo,
      codigo: 'uniplus.selecao.banca.recusa',
      mensagem,
      pagina: null,
      ordem: 0,
      resposta: 1,
      origem: 'gravacao',
      aConferir: false,
      nota,
    });
    const grupo = (chave: string) => raiz().querySelector(`[role=group][id="bancas-${chave}"]`);

    beforeEach(() => {
      atualizar([
        umaBancaDeclarada({ identificadorLocal: 'banca-1', tipoBancaId: 'entrevista' }),
        umaBancaDeclarada({ identificadorLocal: 'banca-2', tipoBancaId: 'entrevista' }),
      ]);
      fixture.componentRef.setInput(
        'recusasPorBanca',
        new Map([['banca-2', [recusa('bancas.banca-2', 'Recusa da segunda.')]]]),
      );
      fixture.componentRef.setInput('recusas', [
        recusa('bancas', 'Recusa da seção.', 'Sobre uma banca que não está mais nesta tela.'),
      ]);
      fixture.detectChanges();
    });

    it('descreve só o grupo da banca recusada pelo bloco das recusas dela', () => {
      expect(grupo('banca-2')?.getAttribute('aria-describedby')).toBe('bancas-banca-2-recusas');
      expect(raiz().querySelector('#bancas-banca-2-recusas')?.textContent).toContain(
        'Recusa da segunda.',
      );
      expect(grupo('banca-1')?.getAttribute('aria-describedby')).toBeNull();
    });

    it('não marca o grupo como inválido: isso cabe só aos controles', () => {
      expect(raiz().querySelector('[aria-invalid]')).toBeNull();
    });

    it('mostra a recusa da seção, com a nota, no bloco da seção que recebe foco', () => {
      const bloco = raiz().querySelector('#bancas-recusas');

      expect(bloco?.textContent).toContain('Recusa da seção.');
      expect(bloco?.textContent).toContain('Sobre uma banca que não está mais nesta tela.');
      expect(bloco?.getAttribute('tabindex')).toBe('-1');
    });
  });
});
