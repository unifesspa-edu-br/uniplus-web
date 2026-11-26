import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usarFase, type ContextoDaFase } from '../fase-passo.testing';
import {
  aAlternativaDaEdicao,
  abrirAFase,
  elementoDe,
  umaFaseQueHomologa,
  umaRegra,
} from './homologacao-da-fase.testing';

const ENQUADRAMENTO = 'Para quem a condição vale (opcional)';

const MEDICINA = umaRegra({
  alternativas: [
    aAlternativaDaEdicao(2024),
    aAlternativaDaEdicao(2025),
    aAlternativaDaEdicao(2026),
  ],
});

describe('HomologacaoDaFaseComponent: acessibilidade', () => {
  let tela: ContextoDaFase;

  usarFase((contexto) => {
    tela = contexto;
  });

  beforeEach(() => {
    document.body.appendChild(tela.nativo);
  });

  afterEach(() => {
    tela.nativo.remove();
  });

  const violacoes = async () =>
    (
      await axe.run(tela.nativo.querySelector('sel-homologacao-da-fase') as HTMLElement, {
        rules: { region: { enabled: false } },
      })
    ).violations;

  it('não tem violações ao declarar a regra', async () => {
    await abrirAFase(tela, umaFaseQueHomologa());

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações com as três alternativas da Medicina', async () => {
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: MEDICINA }));

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações com a edição que o processo deixou de declarar', async () => {
    await abrirAFase(
      tela,
      umaFaseQueHomologa({
        regraDeHomologacao: umaRegra({ alternativas: [aAlternativaDaEdicao(2023)] }),
      }),
    );

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações sem edição declarada', async () => {
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: MEDICINA }), { edicoes: [] });

    expect(await violacoes()).toEqual([]);
  });

  it('não tem violações em consulta', async () => {
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: MEDICINA }), {
      emConsulta: true,
    });

    expect(await violacoes()).toEqual([]);
  });

  it('dá a cada campo um nome acessível pelo rótulo visível', async () => {
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: MEDICINA }));

    const campos = tela.nativo.querySelectorAll<HTMLSelectElement>(
      'sel-homologacao-da-fase select',
    );

    expect(campos.length).toBeGreaterThan(1 + 3 * 3);
    for (const campo of campos) {
      expect(campo.labels?.[0]?.textContent?.trim()).not.toBe('');
    }
    expect(elementoDe<HTMLSelectElement>(tela.nativo, 'homologacao-resultado').labels?.length).toBe(
      1,
    );
  });

  it('agrupa cada alternativa e cada condição num grupo nomeado', async () => {
    await abrirAFase(tela, umaFaseQueHomologa({ regraDeHomologacao: MEDICINA }));

    const legendas = Array.from(tela.nativo.querySelectorAll('sel-homologacao-da-fase legend')).map(
      (legenda) => legenda.textContent?.trim(),
    );

    expect(legendas).toEqual([
      'Alternativa 1',
      'Condição 1',
      ENQUADRAMENTO,
      'Alternativa 2',
      'Condição 1',
      ENQUADRAMENTO,
      'Alternativa 3',
      'Condição 1',
      ENQUADRAMENTO,
    ]);
  });
});
