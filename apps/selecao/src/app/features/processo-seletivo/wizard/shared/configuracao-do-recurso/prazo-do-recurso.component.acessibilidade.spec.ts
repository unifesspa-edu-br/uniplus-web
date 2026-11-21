import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { montarPrazo, umaRecusa } from './prazo-do-recurso.testing';

const violacoes = async (fixture: ReturnType<typeof montarPrazo>) =>
  (await axe.run(fixture.nativeElement, { rules: { region: { enabled: false } } })).violations;

describe('PrazoDoRecursoComponent: acessibilidade', () => {
  it.each([
    ['em branco', {}],
    ['obrigatório e preenchido', { textoDeObrigatoriedade: '(obrigatório)', valor: '2' }],
    ['com unidade fora do vocabulário', { valor: '2', unidade: 'dias' }],
    ['com problema', { problema: 'O prazo precisa ser um número.' }],
    ['com recusa ativa', { recusasDoValor: [umaRecusa('prazoValor')] }],
    ['com recusa a conferir', { recusasDaUnidade: [umaRecusa('prazoUnidade', true)] }],
  ])('não tem violações %s', async (_nome, entradas) => {
    const fixture = montarPrazo(entradas);

    expect(await violacoes(fixture)).toEqual([]);
    fixture.nativeElement.remove();
  });
});
