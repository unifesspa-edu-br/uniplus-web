import { FormControl } from '@angular/forms';
import { CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  CONDICAO_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCondicao,
  mensagemDoCampo,
  valoresDaCondicao,
} from './condicao-atendimento-form';

const condicao: CondicaoAtendimentoDto = {
  id: 'c1',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '',
};

describe('formulário de condição de atendimento', () => {
  it('só valida com código no formato e nome preenchidos, e a descrição é opcional', () => {
    const form = criarFormularioDeCondicao();
    expect(form.invalid).toBe(true);
    form.reset(valoresDaCondicao(condicao));
    expect(form.valid).toBe(true);
    form.controls.codigo.setValue('ledor');
    expect(form.controls.codigo.errors).toHaveProperty('pattern');
  });

  it('prepara os comandos sem os brancos, com o id só na atualização', () => {
    const valores = { codigo: 'LEDOR', nome: '  Ledor ', descricao: '   ' };
    expect(comandoDeCriacao(valores)).toEqual({ codigo: 'LEDOR', nome: 'Ledor', descricao: null });
    expect(comandoDeAtualizacao('c1', valores)).toEqual({
      id: 'c1',
      codigo: 'LEDOR',
      nome: 'Ledor',
      descricao: null,
    });
    expect(comandoDeCriacao(CONDICAO_EM_BRANCO)).toEqual({
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
    const form = criarFormularioDeCondicao();
    const tocar = (valor: string, nome: 'codigo' | 'nome' | 'descricao'): string | null => {
      form.controls[nome].setValue(valor);
      form.controls[nome].markAsTouched();
      return mensagemDoCampo(form.controls[nome]);
    };

    it('não mostra mensagem antes de o campo ser tocado ou editado', () => {
      const nome = criarFormularioDeCondicao().controls.nome;
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
      expect(tocar('x'.repeat(1001), 'descricao')).toBe('Informe no máximo 1000 caracteres.');
      expect(tocar('9', 'codigo')).toContain('Informe ao menos');
      expect(tocar('9X', 'codigo')).toContain('Formato inválido');
      expect(tocar('A'.repeat(300), 'codigo')).toBe('Informe no máximo 50 caracteres.');
    });

    it('cai na mensagem genérica para outra regra violada', () => {
      const controle = new FormControl('x');
      controle.markAsTouched();
      controle.setErrors({ outra: true });
      expect(mensagemDoCampo(controle)).toBe('Valor inválido.');
    });
  });
});
