import { describe, expect, it } from 'vitest';

import { campoDoServidor, mensagemDoErroDoCampo } from './campos-da-publicacao';

describe('campos da publicação', () => {
  it.each([
    ['Assinante', 'assinante'],
    ['Request.MotivoDaCorrecao', 'motivoDaCorrecao'],
    ['PoliticaDeDivulgacaoConfirmada', 'politicaDeDivulgacaoConfirmada'],
    ['Anexos[0].Nome', null],
    ['DocumentoPrincipalId', null],
  ])('liga o campo %s do servidor ao controle %s do formulário', (campo, esperado) => {
    expect(campoDoServidor(campo)).toBe(esperado);
  });

  it('prefere a mensagem do servidor à da tela', () => {
    const erros = { required: true, servidor: { mensagem: 'Número já usado.' } };

    expect(mensagemDoErroDoCampo('numero', erros)).toBe('Número já usado.');
  });

  it.each([
    ['assinante', { required: true }, 'Campo obrigatório.'],
    ['motivoDaCorrecao', { maxlength: { requiredLength: 1000, actualLength: 1001 } }, 'O texto passa do tamanho permitido.'],
    ['politicaDeDivulgacaoConfirmada', { required: true }, 'Confirme que o documento segue a política de divulgação do certame.'],
  ] as const)('explica o erro de %s', (campo, erros, mensagem) => {
    expect(mensagemDoErroDoCampo(campo, erros)).toBe(mensagem);
  });
});
