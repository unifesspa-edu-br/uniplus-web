import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FocoDoEditor } from './foco-do-editor.service';

function telaComRecusa(): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = `<div class="step-error"></div><div class="step-pane">
    <fieldset tabindex="-1" aria-describedby="recusa"><legend>Candidatos atendidos</legend>
    <p id="recusa">Defina os candidatos atendidos.</p></fieldset></div>`;
  document.body.append(raiz);
  TestBed.configureTestingModule({
    providers: [FocoDoEditor, { provide: ElementRef, useValue: new ElementRef(raiz) }],
  });
  return raiz;
}

describe('FocoDoEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  it('mantém o foco no conjunto descrito pela recusa ao revelar o erro do passo', async () => {
    vi.useFakeTimers();
    const raiz = telaComRecusa();
    const campo = raiz.querySelector('fieldset');
    campo?.focus();

    TestBed.inject(FocoDoEditor).revelarErro(() => undefined);
    await vi.runAllTimersAsync();

    expect(document.activeElement).toBe(campo);
  });
});
