import { beforeEach, describe, expect, it } from 'vitest';
import {
  CenarioDoEditorDeFormulario,
  conteudo,
  FAMILIA,
  item,
} from './editor-de-formulario.testing';

let cenario: CenarioDoEditorDeFormulario;
const predicado = [[{ fato: 'A', operador: 'IGUAL', valor: true }]];
const condicional = { tipo: 'QUANDO', predicado };

function comImpedimento(mensagem: string): void {
  const impedimento = { quando: predicado, mensagem };
  cenario.entrada('conteudo', { ...conteudo, itens: [item('A', 0, { regras: { impedimento } })] });
  cenario.detectar();
}

function alterar(id: string, valor: string, evento: string): void {
  const campo = cenario.tela.querySelector(`#${id}`) as HTMLInputElement;
  campo.value = valor;
  campo.dispatchEvent(new Event(evento));
  cenario.detectar();
}

describe('Edição de campos e grupos', () => {
  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('altera o rótulo do campo', () => {
    alterar('f-item-A-rotulo', 'Pergunta revisada', 'input');
    expect(cenario.emitidos.at(-1)?.itens?.[0].apresentacao.rotulo).toBe('Pergunta revisada');
  });

  it('transforma ajuda composta só de espaços em ausência de ajuda', () => {
    alterar('f-item-A-ajuda', '  ', 'input');
    expect(cenario.emitidos.at(-1)?.itens?.[0].apresentacao.ajuda).toBeNull();
  });

  it('retira o predicado ao tornar o campo opcional', () => {
    const regras = { obrigatoriedade: condicional };
    cenario.entrada('conteudo', { ...conteudo, itens: [item('B', 0, { regras })] });
    cenario.detectar();
    alterar('f-item-B-obrigatoriedade', 'NUNCA', 'change');
    expect(cenario.emitidos.at(-1)?.itens?.[0].regras.obrigatoriedade).toEqual({
      tipo: 'NUNCA',
      predicado: null,
    });
  });

  it('altera o rótulo do grupo', () => {
    cenario.entrada('conteudo', { ...conteudo, grupos: [FAMILIA] });
    cenario.detectar();
    alterar('f-grupo-FAMILIA-rotulo', 'Moradores', 'input');
    expect(cenario.emitidos.at(-1)?.grupos?.[0].rotulo).toBe('Moradores');
  });

  it('retira o predicado ao tornar o grupo opcional', () => {
    cenario.entrada('conteudo', {
      ...conteudo,
      grupos: [{ ...FAMILIA, regras: { ...FAMILIA.regras, obrigatoriedade: condicional } }],
    });
    cenario.detectar();
    alterar('f-grupo-FAMILIA-obrigatoriedade', 'NUNCA', 'change');
    expect(cenario.emitidos.at(-1)?.grupos?.[0].regras.obrigatoriedade).toEqual({
      tipo: 'NUNCA',
      predicado: null,
    });
  });

  it('atualiza a mensagem do impedimento sem alterar sua condição', () => {
    comImpedimento('Anterior');
    alterar('f-item-A-impedimento-mensagem', 'Inscrição indisponível.', 'input');
    expect(cenario.emitidos.at(-1)?.itens?.[0].regras.impedimento).toEqual({
      quando: predicado,
      mensagem: 'Inscrição indisponível.',
    });
  });

  it('desligar o impedimento remove a condição e a mensagem', () => {
    comImpedimento('Indisponível');
    const caixa = [...cenario.tela.querySelectorAll('input[type="checkbox"]')].find((c) =>
      c.parentElement?.textContent?.includes('Impedir a inscrição'),
    ) as HTMLInputElement;
    caixa.click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.itens?.[0].regras.impedimento).toBeNull();
  });
});
