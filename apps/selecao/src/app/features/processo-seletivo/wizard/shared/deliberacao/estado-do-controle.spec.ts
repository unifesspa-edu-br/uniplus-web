import { describe, expect, it } from 'vitest';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { estadoDoControle } from './estado-do-controle';

const recusa = (aConferir = false): RecusaOrdenada => ({
  campo: 'bancas.banca-1.quorum',
  codigo: 'uniplus.selecao.banca.quorum_fora_do_intervalo',
  mensagem: 'Quórum fora do intervalo.',
  pagina: null,
  ordem: 0,
  resposta: 1,
  origem: 'gravacao',
  aConferir,
});

describe('estadoDoControle', () => {
  it('não descreve nem marca o controle sem erro nem recusa', () => {
    expect(estadoDoControle('q', undefined, [])).toMatchObject({
      invalido: false,
      descritoPor: null,
    });
  });

  it('mostra o erro da tela e o liga ao controle', () => {
    expect(estadoDoControle('q', 'Confira.', [])).toMatchObject({
      erro: 'Confira.',
      invalido: true,
      descritoPor: 'q-erro',
    });
  });

  it('esconde o erro da tela enquanto uma recusa do servidor ainda vale', () => {
    expect(estadoDoControle('q', 'Confira.', [recusa()])).toMatchObject({
      erro: undefined,
      invalido: true,
      descritoPor: 'q-recusas',
    });
  });

  it('mostra a recusa a conferir sem marcar o controle e volta com o erro da tela', () => {
    expect(estadoDoControle('q', 'Confira.', [recusa(true)])).toMatchObject({
      erro: 'Confira.',
      invalido: true,
      descritoPor: 'q-erro q-recusas',
    });
    expect(estadoDoControle('q', undefined, [recusa(true)])).toMatchObject({
      invalido: false,
      descritoPor: 'q-recusas',
    });
  });

  it('junta dica, erro da tela e recusas, nessa ordem', () => {
    expect(estadoDoControle('q', 'Confira.', [recusa(true)], true).descritoPor).toBe(
      'q-dica q-erro q-recusas',
    );
  });

  it('ignora o erro da tela vazio', () => {
    expect(estadoDoControle('q', '', [])).toMatchObject({ erro: undefined, invalido: false });
  });
});
