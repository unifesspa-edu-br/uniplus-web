import { TIPOS_DE_CAMPO_SIMULADOS, rotuloSimuladoDoTipoDeCampo } from '@uniplus/shared-testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario, conteudo, item } from './editor-de-formulario.testing';
import type { ConteudoDoFormulario } from './modelo/tipos';

describe('EditorDeFormularioComponent: tipo de campo do cartão', () => {
  let cenario: CenarioDoEditorDeFormulario;

  const tipoMostrado = (): string[] =>
    [...cenario.tela.querySelectorAll('ui-tag')].map((tag) => tag.textContent?.trim() ?? '');

  const comTipo = (tipoDeCampo: string): ConteudoDoFormulario => ({
    ...conteudo,
    itens: [item('A', 0, { apresentacao: { tipoDeCampo } })],
  });

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('mostra o rótulo que o vocabulário traz para o código do item', () => {
    cenario.entrada('conteudo', comTipo('DATA'));
    cenario.entrada('tiposDeCampo', TIPOS_DE_CAMPO_SIMULADOS);
    cenario.detectar();

    expect(tipoMostrado()).toContain(rotuloSimuladoDoTipoDeCampo('DATA'));
  });

  it('mostra o próprio código quando o vocabulário não o traz', () => {
    cenario.entrada('conteudo', comTipo('TIPO_NOVO'));
    cenario.entrada('tiposDeCampo', TIPOS_DE_CAMPO_SIMULADOS);
    cenario.detectar();

    expect(tipoMostrado()).toContain('TIPO_NOVO');
  });

  it('mostra o código enquanto o vocabulário não chegou, e o rótulo depois', () => {
    cenario.entrada('conteudo', comTipo('NUMERO'));
    cenario.detectar();
    expect(tipoMostrado()).toContain('NUMERO');

    cenario.entrada('tiposDeCampo', TIPOS_DE_CAMPO_SIMULADOS);
    cenario.detectar();
    expect(tipoMostrado()).toContain(rotuloSimuladoDoTipoDeCampo('NUMERO'));
  });

  it('mantém só o código no conteúdo emitido ao editar o item', () => {
    cenario.entrada('conteudo', comTipo('DATA'));
    cenario.entrada('tiposDeCampo', TIPOS_DE_CAMPO_SIMULADOS);
    cenario.detectar();
    const campo = cenario.tela.querySelector('textarea, input[type="text"]') as HTMLInputElement;
    campo.value = 'Novo texto';
    campo.dispatchEvent(new Event('input'));
    cenario.detectar();

    const emitido = cenario.emitidos.at(-1)?.itens?.[0];
    expect(emitido?.apresentacao.tipoDeCampo).toBe('DATA');
  });
});
