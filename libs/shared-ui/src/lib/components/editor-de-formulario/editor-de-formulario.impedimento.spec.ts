import { EMPTY } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { CenarioDoEditorDeFormulario, conteudo, fato, item } from './editor-de-formulario.testing';
import type { ConteudoDoFormulario, FatoDoFormulario } from './modelo/tipos';

describe('EditorDeFormularioComponent: impedimento', () => {
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('ligar o impedimento cita a resposta do próprio campo e torna o campo obrigatório', () => {
    const opcional: ConteudoDoFormulario = {
      ...conteudo,
      itens: [item('A', 0, { regras: { obrigatoriedade: { tipo: 'NUNCA', predicado: null } } })],
    };
    cenario.entrada('conteudo', opcional);
    cenario.detectar();

    const caixa = [...cenario.tela.querySelectorAll('input[type="checkbox"]')].find((c) =>
      c.parentElement?.textContent?.includes('Impedir a inscrição'),
    ) as HTMLInputElement;
    caixa.click();
    cenario.detectar();

    const ligado = cenario.emitidos.at(-1)?.itens?.[0];
    expect(ligado?.regras.obrigatoriedade.tipo).toBe('SEMPRE');
    expect(ligado?.regras.impedimento?.quando?.[0]?.[0]?.fato).toBe('A');
  });
});

describe('EditorDeFormularioComponent: impedimento com a busca de municípios', () => {
  it('oferece o impedimento no campo de município, com a condição sobre a resposta dele', () => {
    const cenario = CenarioDoEditorDeFormulario.preparar([
      { provide: BUSCA_DE_MUNICIPIOS, useValue: () => EMPTY },
    ]);
    cenario.montar();
    const municipio: FatoDoFormulario = {
      ...fato('MUNICIPIO'),
      dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
      fonteValores: { codigo: 'MUNICIPIOS', rotulo: 'MUNICIPIOS' },
    };
    cenario.entrada('conteudo', {
      ...conteudo,
      itens: [item('MUNICIPIO', 0, { apresentacao: { tipoRenderizacao: 'MUNICIPIO' } })],
    });
    cenario.entrada('catalogo', [municipio]);
    cenario.detectar();

    const caixa = [...cenario.tela.querySelectorAll('input[type="checkbox"]')].find((c) =>
      c.parentElement?.textContent?.includes('Impedir a inscrição'),
    ) as HTMLInputElement | undefined;
    caixa?.click();

    expect(cenario.emitidos.at(-1)?.itens?.[0]?.regras.impedimento?.quando).toEqual([
      [{ fato: 'MUNICIPIO', operador: 'IGUAL', valor: '' }],
    ]);
  });
});
