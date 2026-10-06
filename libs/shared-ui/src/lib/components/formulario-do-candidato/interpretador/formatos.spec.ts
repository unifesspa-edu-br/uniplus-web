import { atendeAoFormato, ufDoCodigoIbge } from './formatos';

/**
 * Os formatos de texto conferem como os tipos de valor da API: os exemplos são os dos testes deles,
 * para o interpretador não aceitar o que o servidor recusa, nem recusar o que ele aceita.
 */
describe('formatos de texto', () => {
  it.each([
    ['CPF', '529.982.247-25', true],
    ['CPF', '529982247-25', true],
    ['CPF', '111.222.333-44', false],
    ['CPF', '00000000000', false],
    ['CPF', '529a982.247-25', false],
    ['CPF', '１２３４５６７８９67', false],
    ['TELEFONE', '(94) 3322-1234', true],
    ['TELEFONE', '94 99123-4567', true],
    ['TELEFONE', '(04) 3322-1234', false],
    ['TELEFONE', '(94) 83322-1234', false],
    ['TELEFONE', '(٩٤) ٣٣٢٢-١٢٣٤', false],
    ['CEP', '68507-590', true],
    ['CEP', '00000-000', false],
    ['CEP', 'CEP:68507590xyz', false],
    ['NOME_PESSOA', 'José Silva', true],
    ['NOME_PESSOA', 'Joana D’Arc', true],
    ['NOME_PESSOA', 'Maria', false],
    ['NOME_PESSOA', 'Maria 2 Silva', false],
    ['EMAIL', 'USUARIO@EXEMPLO.COM', true],
    ['EMAIL', 'sem@dominio', false],
    ['EMAIL', 'dois@@arroba.com', false],
    ['LIVRE', 'qualquer texto', true],
  ])('%s "%s" atende: %s', (formato, texto, atende) => {
    expect(atendeAoFormato(formato, texto)).toBe(atende);
  });

  it('a UF do município sai do prefixo do código IBGE de sete dígitos', () => {
    expect([
      ufDoCodigoIbge('1505536'),
      ufDoCodigoIbge('9905536'),
      ufDoCodigoIbge('150553'),
    ]).toEqual(['PA', null, null]);
  });
});
