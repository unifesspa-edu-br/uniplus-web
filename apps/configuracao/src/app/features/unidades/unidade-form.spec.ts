import { TipoUnidade } from '@uniplus/shared-data/organizacao';
import { describe, expect, it } from 'vitest';
import {
  ALIAS_TAMANHO_MAXIMO,
  CODIGO_TAMANHO_MAXIMO,
  NOME_TAMANHO_MAXIMO,
  SIGLA_TAMANHO_MAXIMO,
  cidadeDaEdicao,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeUnidade,
  valoresDaUnidade,
} from './unidade-form';
import { instituto, reitoria } from './unidades.testing';

describe('unidade-form', () => {
  it('cada campo de texto recusa o excesso do limite do domínio', () => {
    const form = criarFormularioDeUnidade();
    const limites = {
      nome: NOME_TAMANHO_MAXIMO,
      alias: ALIAS_TAMANHO_MAXIMO,
      sigla: SIGLA_TAMANHO_MAXIMO,
      codigo: CODIGO_TAMANHO_MAXIMO,
    } as const;
    for (const [campo, maximo] of Object.entries(limites)) {
      const controle = form.controls[campo as keyof typeof limites];
      controle.setValue('a'.repeat(maximo));
      expect(controle.hasError('maxlength'), `${campo} no limite`).toBe(false);
      controle.setValue('a'.repeat(maximo + 1));
      expect(controle.hasError('maxlength'), `${campo} acima do limite`).toBe(true);
    }
  });

  it('o nome exige ao menos 2 caracteres', () => {
    const form = criarFormularioDeUnidade();
    form.controls.nome.setValue('A');
    expect(form.controls.nome.hasError('minlength')).toBe(true);
    form.controls.nome.setValue('AB');
    expect(form.controls.nome.valid).toBe(true);
  });

  it('o formulário em branco é inválido e nasce com tipo e vigência preenchidos', () => {
    const form = criarFormularioDeUnidade();
    expect(form.valid).toBe(false);
    expect(form.controls.tipo.value).toBe(TipoUnidade.instituto);
    expect(form.controls.vigenciaInicio.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a edição traz o tipo do rótulo; rótulo desconhecido deixa o tipo em branco', () => {
    expect(valoresDaUnidade(reitoria).tipo).toBe(TipoUnidade.reitoria);
    expect(valoresDaUnidade({ ...instituto, tipo: 'Inexistente' as never }).tipo).toBe('');
  });

  it('o campo do servidor casa por caixa e rejeita o desconhecido', () => {
    expect(controleDoCampoDoServidor('Sigla')).toBe('sigla');
    expect(controleDoCampoDoServidor('unidadeSuperiorId')).toBe('unidadeSuperiorId');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });

  it('a cidade da edição é nula sem código IBGE', () => {
    expect(cidadeDaEdicao({ ...reitoria, cidadeCodigoIbge: null })).toBeNull();
    expect(cidadeDaEdicao(reitoria)).toEqual({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  it('o comando de atualização não leva o início da vigência; o de criação leva', () => {
    const valor = valoresDaUnidade(reitoria);

    expect('vigenciaInicio' in comandoDeAtualizacao(reitoria.id, valor, null)).toBe(false);
    expect(comandoDeCriacao(valor, null).vigenciaInicio).toBe('2020-01-01');
  });
});
