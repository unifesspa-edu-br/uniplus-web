import { beforeEach, describe, expect, it } from 'vitest';
import {
  CenarioDoEditorDeFormulario,
  conteudo,
  FAMILIA,
  fato,
  item,
} from '../editor-de-formulario.testing';

let cenario: CenarioDoEditorDeFormulario;

function botao(texto: string, raiz: ParentNode = cenario.tela): HTMLButtonElement {
  return [...raiz.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(texto),
  ) as HTMLButtonElement;
}

function alterar(id: string, valor: string): void {
  const campo = cenario.tela.querySelector(`#${id}`) as HTMLSelectElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('change'));
  cenario.detectar();
}

function ancestral(id: string, seletor: string): Element {
  return cenario.tela.querySelector(`#${id}`)?.closest(seletor) as Element;
}

function comCamposDoGrupo(codigos: string[]): void {
  const subitens = codigos.map((codigo, ordem) => item(codigo, ordem, { paginaCodigo: null }));
  cenario.entrada('conteudo', { ...conteudo, grupos: [{ ...FAMILIA, subitens }] });
  cenario.detectar();
}

function oferecerFatosDeMembro(): void {
  const membros = ['RENDA', 'IDADE'].map((codigo) => ({ ...fato(codigo), escopo: 'MEMBRO_GRUPO' }));
  cenario.entrada('catalogo', [fato('A'), fato('B'), fato('C'), ...membros]);
  cenario.detectar();
}

describe('Campos do grupo', () => {
  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('campos de grupo oferecem fatos de membro e acrescentam o escolhido', () => {
    comCamposDoGrupo(['RENDA']);
    oferecerFatosDeMembro();
    alterar('f-grupo-FAMILIA-acrescentar', 'IDADE');
    botao('Acrescentar campo ao grupo').click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.grupos?.[0].subitens.map((c) => c.fatoCodigo)).toEqual([
      'RENDA',
      'IDADE',
    ]);
    expect(cenario.status()).toContain('Campo “IDADE” acrescentado');
  });

  it('move um campo do grupo e anuncia sua posição', () => {
    comCamposDoGrupo(['RENDA', 'IDADE']);
    cenario.clicar('f-grupo-FAMILIA-campo-IDADE-subir');
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.grupos?.[0].subitens.map((c) => c.fatoCodigo)).toEqual([
      'IDADE',
      'RENDA',
    ]);
    expect(cenario.status()).toContain('movido para a posição 1 de 2');
  });

  it('remove um campo do grupo e anuncia a remoção', () => {
    comCamposDoGrupo(['RENDA', 'IDADE']);
    const campo = ancestral('f-grupo-FAMILIA-campo-IDADE-titulo', 'article');
    botao('Remover', campo).click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.grupos?.[0].subitens.map((c) => c.fatoCodigo)).toEqual([
      'RENDA',
    ]);
    expect(cenario.status()).toBe('Campo “Campo IDADE” removido de Família.');
  });
});
