import { describe, expect, it } from 'vitest';
import {
  CURSO_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCurso,
  valoresDoCurso,
} from './curso-form';

const curso = {
  id: 'c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: { codigo: ' TECNOLOGICA ', rotulo: 'Tecnológica' },
  criadoEm: '',
};

describe('formulário de curso', () => {
  it('exige código, nome, grau e nível, e respeita o tamanho máximo de cada um', () => {
    const form = criarFormularioDeCurso();
    expect(form.invalid).toBe(true);
    form.setValue({ ...CURSO_EM_BRANCO, codigo: 'A', nome: 'B', grau: 'C', nivelEnsino: 'D' });
    expect(form.valid).toBe(true);

    form.controls.codigo.setValue('x'.repeat(61));
    form.controls.nome.setValue('x'.repeat(201));
    expect(form.controls.codigo.hasError('maxlength')).toBe(true);
    expect(form.controls.nome.hasError('maxlength')).toBe(true);
  });

  it('o grupo do ENEM é opcional e o valor do curso o traz sem espaços nas pontas', () => {
    expect(criarFormularioDeCurso().controls.grupoAreaEnem.valid).toBe(true);
    expect(valoresDoCurso(curso).grupoAreaEnem).toBe('TECNOLOGICA');
    expect(valoresDoCurso({ ...curso, grupoAreaEnem: null }).grupoAreaEnem).toBe('');
  });

  it('o comando manda nulo no que está em branco e leva o id na atualização', () => {
    const valores = { ...valoresDoCurso(curso), grupoAreaEnem: '  ' };
    expect(comandoDeCriacao(valores).grupoAreaEnem).toBeNull();
    expect(comandoDeAtualizacao('c1', valores)).toMatchObject({ id: 'c1', codigo: 'ENG-CIV' });
  });

  it('o campo recusado pelo servidor vira o controle do formulário, e o desconhecido, nulo', () => {
    expect(controleDoCampoDoServidor('NivelEnsino')).toBe('nivelEnsino');
    expect(controleDoCampoDoServidor('GrupoAreaEnem')).toBe('grupoAreaEnem');
    expect(controleDoCampoDoServidor('Outro')).toBeNull();
  });
});
