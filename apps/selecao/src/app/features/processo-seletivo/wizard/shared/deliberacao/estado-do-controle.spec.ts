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
  it('sem erro nem recusa, o controle é válido e nada o descreve', () => {
    const estado = estadoDoControle('banca-quorum', undefined, []);
    expect(estado.invalido).toBe(false);
    expect(estado.descritoPor).toBeNull();
  });

  it('o erro da tela marca o controle e entra na descrição, depois da dica', () => {
    const estado = estadoDoControle('banca-quorum', 'Informe o quórum.', [], true);
    expect(estado.invalido).toBe(true);
    expect(estado.descritoPor).toBe('banca-quorum-dica banca-quorum-erro');
  });

  it('o erro da tela e a recusa do servidor aparecem juntos', () => {
    const estado = estadoDoControle('banca-quorum', 'Informe o quórum.', [recusa()]);
    expect(estado.erro).toBe('Informe o quórum.');
    expect(estado.descritoPor).toBe('banca-quorum-erro banca-quorum-recusas');
  });
});
