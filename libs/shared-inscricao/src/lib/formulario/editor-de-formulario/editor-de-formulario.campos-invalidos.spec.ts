import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario } from './editor-de-formulario.testing';

describe('EditorDeFormularioComponent: campos inválidos', () => {
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('dá a cada campo das ocorrências a mensagem do próprio erro', () => {
    cenario.comGrupo(-1, 'dez');

    const minimo = cenario.tela.querySelector('#f-grupo-FAMILIA-minimo') as HTMLInputElement;
    const maximo = cenario.tela.querySelector('#f-grupo-FAMILIA-maximo') as HTMLInputElement;
    const doMinimo = cenario.tela.querySelector('#f-grupo-FAMILIA-minimo-erro') as HTMLElement;
    const doMaximo = cenario.tela.querySelector('#f-grupo-FAMILIA-maximo-erro') as HTMLElement;

    expect(doMinimo.textContent).toContain('O mínimo é um número inteiro, a partir de zero.');
    expect(doMaximo.textContent).toContain('O máximo é um número inteiro, a partir de um.');
    expect(minimo.getAttribute('aria-describedby')).toBe(doMinimo.id);
    expect(maximo.getAttribute('aria-describedby')).toContain(doMaximo.id);
    expect(maximo.getAttribute('aria-describedby')).not.toContain(doMinimo.id);
  });

  it('abre a seção recolhida que guarda o campo inválido e leva o foco a ele', async () => {
    cenario.comGrupo(1, 'dez');
    (cenario.tela.querySelector('#f-pagina-S1-nome button') as HTMLButtonElement).click();
    cenario.detectar();
    expect((cenario.tela.querySelector('#f-pagina-S1-corpo') as HTMLElement).hidden).toBe(true);

    const chegou = cenario.fixture.componentInstance.focarPrimeiroCampoInvalido();
    cenario.detectar();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(await chegou).toBe(true);
    expect((cenario.tela.querySelector('#f-pagina-S1-corpo') as HTMLElement).hidden).toBe(false);
    expect(document.activeElement).toBe(cenario.tela.querySelector('#f-grupo-FAMILIA-maximo'));
  });
});
