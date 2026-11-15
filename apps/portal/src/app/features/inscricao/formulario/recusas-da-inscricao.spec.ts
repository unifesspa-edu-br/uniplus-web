import { describe, expect, it } from 'vitest';

import { mensagemDaRecusa } from './recusas-da-inscricao';

describe('mensagemDaRecusa', () => {
  it('o documento obrigatório ausente diz ao candidato o que fazer, e não a mensagem genérica', () => {
    expect(mensagemDaRecusa('uniplus.selecao.inscricao.documento_obrigatorio_ausente')).toBe(
      'Envie este documento, ou uma das alternativas da lista, para concluir.',
    );
  });

  it.each([
    'uniplus.selecao.inscricao.data_nascimento_invalida',
    'uniplus.selecao.inscricao.endereco_residencial_invalido',
  ])('o código %s, que a API não registra mais, cai na mensagem genérica', (codigo) => {
    expect(mensagemDaRecusa(codigo)).toBe('Revise esta resposta.');
  });

  it('o código que a API ainda emite mantém a mensagem própria', () => {
    expect(mensagemDaRecusa('uniplus.selecao.inscricao.termo_nao_aceito')).toBe(
      'Aceite o termo para concluir.',
    );
  });
});
