import { describe, expect, it } from 'vitest';

import { exigencia, regraDoRascunho } from '../../shared/exigencias/exigencias.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('Conferência da quantidade do grupo', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  it('impede a gravação quando a quantidade supera os documentos', () => {
    const documento = regraDoRascunho({ forma: 'DOCUMENTO', documento: exigencia() });
    const grupo = regraDoRascunho({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      quantidadeMinima: 3,
      itens: [documento, documento],
    });
    tela.store.patchSection('documentos', { emTodasAsFases: [], regrasDeComprovacao: [grupo] });
    const resultado = tela.conferencia.validar();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Corrija a quantidade mínima dos documentos combinados.');
  });
});
