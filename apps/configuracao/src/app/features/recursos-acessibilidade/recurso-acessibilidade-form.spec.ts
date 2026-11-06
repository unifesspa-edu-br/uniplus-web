import { FormControl } from '@angular/forms';
import { RecursoAcessibilidadeDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  RECURSO_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeRecurso,
  mensagemDoCampo,
  valoresDoRecurso,
} from './recurso-acessibilidade-form';

const recurso: RecursoAcessibilidadeDto = {
  id: 'r1',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '',
};

describe('formulário de recurso de acessibilidade', () => {
  it('só valida com nome e código no formato, e a descrição é opcional', () => {
    const form = criarFormularioDeRecurso();
    expect(form.invalid).toBe(true);
    form.reset(valoresDoRecurso(recurso));
    expect(form.valid).toBe(true);
    form.controls.codigo.setValue('ledor');
    expect(form.controls.codigo.errors).toHaveProperty('pattern');
  });

  it('prepara os comandos sem os brancos, com o id só na atualização', () => {
    const valores = { nome: '  Ledor ', codigo: 'LEDOR', descricao: '   ' };
    expect(comandoDeCriacao(valores)).toEqual({ codigo: 'LEDOR', nome: 'Ledor', descricao: null });
    expect(comandoDeAtualizacao('r1', valores)).toEqual({
      id: 'r1',
      codigo: 'LEDOR',
      nome: 'Ledor',
      descricao: null,
    });
    expect(comandoDeCriacao(RECURSO_EM_BRANCO)).toEqual({
      codigo: null,
      nome: null,
      descricao: null,
    });
  });

  it('converte o campo recusado pelo servidor no controle do formulário', () => {
    expect(controleDoCampoDoServidor('Codigo')).toBe('codigo');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });

  describe('mensagem do campo', () => {
    const form = criarFormularioDeRecurso();
    const tocar = (valor: string, nome: 'codigo' | 'nome' | 'descricao'): string | null => {
      form.controls[nome].setValue(valor);
      form.controls[nome].markAsTouched();
      return mensagemDoCampo(form.controls[nome]);
    };

    it('não mostra mensagem antes de o campo ser tocado ou editado', () => {
      const nome = criarFormularioDeRecurso().controls.nome;
      expect(nome.invalid).toBe(true);
      expect(mensagemDoCampo(nome)).toBeNull();
      nome.markAsTouched();
      expect(mensagemDoCampo(nome)).toBe('Campo obrigatório.');
    });

    it('prioriza a recusa do servidor e a obrigatoriedade', () => {
      expect(tocar('', 'nome')).toBe('Campo obrigatório.');
      form.controls.nome.setErrors({ backend: { code: 'x', message: 'Nome recusado.' } });
      expect(mensagemDoCampo(form.controls.nome)).toBe('Nome recusado.');
    });

    it('descreve o tamanho mínimo, o excesso e o formato do código', () => {
      expect(tocar('A', 'nome')).toBe('Informe ao menos 2 caracteres.');
      expect(tocar('x'.repeat(1001), 'descricao')).toBe('Valor acima do tamanho permitido.');
      expect(tocar('9', 'codigo')).toContain('Informe ao menos');
      expect(tocar('9X', 'codigo')).toContain('Formato inválido');
      expect(tocar('A'.repeat(60), 'codigo')).toBe('Valor acima do tamanho permitido.');
    });

    it('cai na mensagem genérica para outra regra violada', () => {
      const controle = new FormControl('x');
      controle.markAsTouched();
      controle.setErrors({ outra: true });
      expect(mensagemDoCampo(controle)).toBe('Valor inválido.');
    });
  });
});
