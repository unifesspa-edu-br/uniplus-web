import { describe, expect, it } from 'vitest';

import { mensagemDaRecusa } from './recusas-da-inscricao';

describe('mensagemDaRecusa', () => {
  it('o documento obrigatório ausente diz ao candidato o que fazer, e não a mensagem genérica', () => {
    expect(mensagemDaRecusa('uniplus.selecao.inscricao.documento_obrigatorio_ausente')).toBe(
      'Envie o documento exigido.',
    );
  });
});
