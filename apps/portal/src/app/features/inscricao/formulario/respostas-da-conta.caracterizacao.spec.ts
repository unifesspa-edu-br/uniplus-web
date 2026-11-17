import { describe, expect, it } from 'vitest';
import type { FormularioRenderizavelDto } from '@uniplus/shared-data/selecao';

import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import { respostasFixasDaConta } from './respostas-da-conta';

/** Fernanda Drumond, persona fictícia do portal de documentação. */
const CPF_DA_PERSONA = '69959836371';
const NOME_DA_PERSONA = 'Fernanda Laura Nicole Drumond';

const formularioQueColeta = (...fatos: string[]): FormularioRenderizavelDto => ({
  ...FORMULARIO_DE_INSCRICAO_MOCK,
  fatosColetados: fatos.map((fatoCodigo) => ({
    ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
    fatoCodigo,
  })),
});

describe('respostasFixasDaConta: o que a conta fixa e o que o formulário coleta', () => {
  const todos = formularioQueColeta('NOME', 'NOME_SOCIAL', 'CPF');

  it('sem formulário carregado, nada é fixado', () => {
    expect(respostasFixasDaConta({ cpf: CPF_DA_PERSONA }, null)).toEqual({});
  });

  it('sem conta, nada é fixado além do nome social vazio e travado', () => {
    expect(respostasFixasDaConta(null, todos)).toEqual({
      NOME_SOCIAL: { valor: null, exibicao: '' },
    });
  });

  it('fixa o nome civil sem os espaços das pontas', () => {
    const fixas = respostasFixasDaConta({ cpf: '', nomeCivil: `  ${NOME_DA_PERSONA}  ` }, todos);

    expect(fixas['NOME']).toEqual({ valor: NOME_DA_PERSONA, exibicao: NOME_DA_PERSONA });
  });

  it('não fixa o nome civil em branco', () => {
    const fixas = respostasFixasDaConta({ cpf: CPF_DA_PERSONA, nomeCivil: '   ' }, todos);

    expect(fixas).not.toHaveProperty('NOME');
  });

  it('fixa o nome social da conta sem os espaços das pontas', () => {
    const fixas = respostasFixasDaConta({ cpf: '', nomeSocial: ' Fernanda ' }, todos);

    expect(fixas['NOME_SOCIAL']).toEqual({ valor: 'Fernanda', exibicao: 'Fernanda' });
  });

  it('a conta sem nome social fixa o campo vazio, com valor nulo', () => {
    const fixas = respostasFixasDaConta({ cpf: '', nomeSocial: '  ' }, todos);

    expect(fixas['NOME_SOCIAL']).toEqual({ valor: null, exibicao: '' });
  });

  it('fixa o CPF só com dígitos, mascarado e revelável a quem o titulariza', () => {
    const fixas = respostasFixasDaConta({ cpf: '699.598.363-71' }, todos);

    expect(fixas['CPF']).toMatchObject({ valor: CPF_DA_PERSONA, exibicao: '***.598.363-**' });
    expect(fixas['CPF']?.revelavel?.visivel).toBe('598.363');
  });

  it('não fixa o CPF que não é válido', () => {
    expect(respostasFixasDaConta({ cpf: '11111111111' }, todos)).not.toHaveProperty('CPF');
    expect(respostasFixasDaConta({ cpf: '' }, todos)).not.toHaveProperty('CPF');
  });

  it('só entram as respostas dos fatos que o formulário coleta', () => {
    const conta = { cpf: CPF_DA_PERSONA, nomeCivil: NOME_DA_PERSONA, nomeSocial: 'Fernanda' };

    expect(Object.keys(respostasFixasDaConta(conta, formularioQueColeta('CPF')))).toEqual(['CPF']);
    expect(Object.keys(respostasFixasDaConta(conta, formularioQueColeta('NOME')))).toEqual([
      'NOME',
    ]);
    expect(respostasFixasDaConta(conta, formularioQueColeta('DATA_NASCIMENTO'))).toEqual({});
  });
});
