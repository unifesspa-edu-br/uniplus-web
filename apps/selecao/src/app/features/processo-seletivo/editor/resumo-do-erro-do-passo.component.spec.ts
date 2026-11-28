import { TestBed } from '@angular/core/testing';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import type { ErroDoPasso } from '../wizard/processo-seletivo.models';
import { ResumoDoErroDoPassoComponent } from './resumo-do-erro-do-passo.component';

const REFERENCIA: ReferenciaAoSuporte = { origem: 'tela', codigo: 'regra_x' };

function montar(erro: ErroDoPasso): HTMLElement {
  const fixture = TestBed.createComponent(ResumoDoErroDoPassoComponent);
  fixture.componentRef.setInput('erro', erro);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ResumoDoErroDoPassoComponent', () => {
  it('conta um erro no singular e lista a mensagem', () => {
    const tela = montar({ mensagens: ['Falta preencher.'], referencias: [] });

    expect(tela.querySelector('.step-error__summary')?.textContent?.trim()).toBe(
      'Há 1 erro no formulário',
    );
    expect(tela.querySelector('li')?.textContent).toBe('Falta preencher.');
  });

  it('conta vários erros no plural', () => {
    const tela = montar({ mensagens: ['Um.', 'Dois.'], referencias: [] });

    expect(tela.querySelector('.step-error__summary')?.textContent?.trim()).toBe(
      'Há 2 erros no formulário',
    );
    expect(tela.querySelectorAll('li')).toHaveLength(2);
  });

  it('sem referência, não mostra o bloco de suporte', () => {
    const tela = montar({ mensagens: ['Falta preencher.'], referencias: [] });

    expect(tela.querySelector('ui-referencia-ao-suporte')).toBeNull();
  });

  it('mostra uma referência por passo, cada uma com o nome do passo', () => {
    const tela = montar({
      mensagens: ['Recusada.'],
      referencias: [
        { passo: 'Passo 2 — Identificação', referencia: REFERENCIA },
        { passo: 'Passo 4 — Vagas', referencia: REFERENCIA },
      ],
    });

    const frases = [...tela.querySelectorAll('ui-referencia-ao-suporte')].map((item) =>
      item.textContent?.trim(),
    );
    expect(frases).toEqual([
      'Informe ao suporte: passo 2 — Identificação, código regra_x.',
      'Informe ao suporte: passo 4 — Vagas, código regra_x.',
    ]);
  });

  it('só as mensagens ficam na região que anuncia o erro', () => {
    const tela = montar({
      mensagens: ['Recusada.'],
      referencias: [{ passo: 'Passo 4 — Vagas', referencia: REFERENCIA }],
    });

    const alerta = tela.querySelector('[role="alert"]') as HTMLElement;
    expect(alerta.textContent).toContain('Recusada.');
    expect(alerta.querySelector('ui-referencia-ao-suporte')).toBeNull();
  });
});
