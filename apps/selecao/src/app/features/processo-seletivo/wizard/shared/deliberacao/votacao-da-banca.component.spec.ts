import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

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
});
