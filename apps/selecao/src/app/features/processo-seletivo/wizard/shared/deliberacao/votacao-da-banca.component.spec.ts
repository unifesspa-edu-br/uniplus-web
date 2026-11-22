import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { COLEGIADA, comRegra } from './regra-de-deliberacao.testing';
import { VotacaoDaBancaComponent } from './votacao-da-banca.component';

describe('VotacaoDaBancaComponent', () => {
  it('emite a regra normalizada ao trocar o critério para unanimidade', () => {
    const fixture = TestBed.createComponent(VotacaoDaBancaComponent);
    fixture.componentRef.setInput('idBase', 'banca');
    fixture.componentRef.setInput('regra', COLEGIADA);
    const emitidas: unknown[] = [];
    fixture.componentInstance.regraChange.subscribe((regra) => emitidas.push(regra));
    fixture.detectChanges();
    const criterio = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#banca-criterio',
    );
    if (criterio === null) throw new Error('Critério ausente');
    criterio.value = 'unanimidade';
    criterio.dispatchEvent(new Event('change'));

    expect(emitidas).toEqual([expect.objectContaining({ criterio: 'unanimidade', desempate: '' })]);
  });

  it('para um integrante, omite desempate e resultado sem unanimidade e associa dica e erro ao quórum', () => {
    const fixture = TestBed.createComponent(VotacaoDaBancaComponent);
    fixture.componentRef.setInput('idBase', 'banca');
    fixture.componentRef.setInput(
      'regra',
      comRegra({ integrantes: '1', encerramento: 'todosOsTitulares' }),
    );
    fixture.componentRef.setInput('erros', { quorum: 'Confira o quórum.' });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const quorum = host.querySelector<HTMLInputElement>('#banca-quorum');

    expect(host.querySelector('#banca-desempate')).toBeNull();
    expect(host.querySelector('#banca-semUnanimidade')).toBeNull();
    expect(quorum?.readOnly).toBe(true);
    expect(quorum?.getAttribute('aria-describedby')).toBe('banca-quorum-dica banca-quorum-erro');
    expect(host.querySelector('#banca-quorum-erro')?.getAttribute('role')).toBe('alert');
  });

  describe('recusas do servidor', () => {
    const recusa = (campo: string, aConferir = false): RecusaOrdenada => ({
      campo: `bancas.banca-1.${campo}`,
      codigo: `uniplus.selecao.banca.recusa_${campo}`,
      mensagem: `Recusa de ${campo}.`,
      pagina: null,
      ordem: 0,
      resposta: 1,
      origem: 'gravacao',
      aConferir,
    });
    const exibir = (entradas: Record<string, unknown>) => {
      const fixture = TestBed.createComponent(VotacaoDaBancaComponent);
      fixture.componentRef.setInput('idBase', 'banca');
      fixture.componentRef.setInput('regra', COLEGIADA);
      for (const [nome, valor] of Object.entries(entradas)) {
        fixture.componentRef.setInput(nome, valor);
      }
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('mostra a recusa ativa sob o controle, ligada a ele, e não o erro da tela', () => {
      const host = exibir({
        recusas: { criterio: [recusa('criterio')] },
        erros: { criterio: 'Da tela.' },
      });
      const criterio = host.querySelector('#banca-criterio');

      expect(host.querySelector('#banca-criterio-recusas')?.textContent).toContain(
        'Recusa de criterio.',
      );
      expect(host.querySelector('#banca-criterio-erro')).toBeNull();
      expect(criterio?.getAttribute('aria-invalid')).toBe('true');
      expect(criterio?.getAttribute('aria-describedby')).toBe('banca-criterio-recusas');
    });

    it('deixa a recusa a conferir à vista, sem marcar o controle, com o erro da tela de volta', () => {
      const host = exibir({
        recusas: { criterio: [recusa('criterio', true)] },
        erros: { criterio: 'Da tela.' },
      });
      const criterio = host.querySelector('#banca-criterio');

      expect(host.querySelector('#banca-criterio-recusas')?.textContent).toContain(
        'conferida de novo',
      );
      expect(host.querySelector('#banca-criterio-erro')?.textContent).toContain('Da tela.');
      expect(criterio?.getAttribute('aria-describedby')).toBe(
        'banca-criterio-erro banca-criterio-recusas',
      );
    });

    it('não mostra o controle de desempate, nem a recusa dele, quando o critério não o pede', () => {
      const host = exibir({
        regra: comRegra({ criterio: 'unanimidade', desempate: '' }),
        recusas: { desempate: [recusa('desempate')] },
      });

      expect(host.querySelector('#banca-desempate')).toBeNull();
      expect(host.querySelector('#banca-desempate-recusas')).toBeNull();
    });
  });
});
