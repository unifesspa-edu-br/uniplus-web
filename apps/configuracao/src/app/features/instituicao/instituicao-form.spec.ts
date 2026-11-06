import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeInstituicao,
  valoresDaInstituicao,
  valoresEmBrancoDaInstituicao,
} from './instituicao-form';
import { unifesspa } from './instituicao.testing';

describe('formulário da Instituição', () => {
  it('só os cinco campos de identificação e classificação são obrigatórios', () => {
    const form = criarFormularioDeInstituicao();
    form.reset(valoresEmBrancoDaInstituicao());

    const obrigatorios = Object.entries(form.controls)
      .filter(([, controle]) => controle.hasError('required'))
      .map(([nome]) => nome);
    expect(obrigatorios).toEqual([
      'nome',
      'sigla',
      'codigoEmec',
      'organizacaoAcademica',
      'categoriaAdministrativa',
    ]);
  });

  it.each([
    ['nome', 250],
    ['sigla', 50],
    ['codigoEmec', 20],
    ['cnpj', 100],
    ['organizacaoAcademica', 100],
    ['categoriaAdministrativa', 100],
    ['mantenedora', 250],
    ['codigoMantenedoraEmec', 20],
    ['situacao', 100],
    ['atoCredenciamento', 500],
    ['atoRecredenciamento', 500],
    ['conceitoInstitucional', 100],
    ['igc', 100],
    ['website', 255],
  ] as const)('respeita o limite de %s da API: %i caracteres', (campo, limite) => {
    const form = criarFormularioDeInstituicao();
    form.controls[campo].setValue('x'.repeat(limite));
    expect(form.controls[campo].hasError('maxlength')).toBe(false);
    form.controls[campo].setValue('x'.repeat(limite + 1));
    expect(form.controls[campo].hasError('maxlength')).toBe(true);
  });

  it('o comando de criação apara os obrigatórios e troca o opcional em branco por nulo', () => {
    const form = criarFormularioDeInstituicao();
    form.reset({
      ...valoresEmBrancoDaInstituicao(),
      nome: '  Universidade  ',
      sigla: 'UF',
      codigoEmec: ' 3990 ',
      organizacaoAcademica: 'Universidade',
      categoriaAdministrativa: 'Pública Federal',
      cnpj: '   ',
      website: ' https://exemplo.edu.br ',
    });

    expect(comandoDeCriacao(form)).toMatchObject({
      nome: 'Universidade',
      codigoEmec: '3990',
      cnpj: null,
      website: 'https://exemplo.edu.br',
      unidadeRaizId: null,
      endereco: null,
    });
  });

  it('o comando de atualização leva o id e os mesmos valores da criação', () => {
    const form = criarFormularioDeInstituicao();
    form.reset(valoresDaInstituicao(unifesspa));

    expect(comandoDeAtualizacao('abc', form)).toEqual({ id: 'abc', ...comandoDeCriacao(form) });
  });

  it('os valores da instituição preenchem o formulário, com vazio no lugar do nulo', () => {
    const valores = valoresDaInstituicao(unifesspa);

    expect(valores.nome).toBe(unifesspa.nome);
    expect(valores.cnpj).toBe('');
    expect(valores.unidadeRaizId).toBe(unifesspa.unidadeRaizId);
    expect(valores.endereco).toBeNull();
  });

  it('resolve o campo recusado pelo servidor, com o caminho e a caixa dele, e ignora o que não existe', () => {
    expect(controleDoCampoDoServidor('CodigoEmec')).toBe('codigoEmec');
    expect(controleDoCampoDoServidor('Cnpj')).toBe('cnpj');
    expect(controleDoCampoDoServidor('Endereco.Cep')).toBeNull();
    expect(controleDoCampoDoServidor('Inexistente')).toBeNull();
  });
});
