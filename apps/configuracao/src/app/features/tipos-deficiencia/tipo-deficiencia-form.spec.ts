import { FormControl } from '@angular/forms';
import { TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeTipoDeficiencia,
  mensagemDoCampo,
  valoresDoTipoDeficiencia,
} from './tipo-deficiencia-form';

const tipo: TipoDeficienciaDto = {
  id: 'r1',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: true,
  criadoEm: '',
};

describe('formulário de tipo de deficiência', () => {
  it('só valida com nome, código no formato e descrição com texto', () => {
    const form = criarFormularioDeTipoDeficiencia();
    expect(form.invalid).toBe(true);
    form.reset(valoresDoTipoDeficiencia(tipo));
    expect(form.valid).toBe(true);
    form.controls.codigo.setValue('visual');
    expect(form.controls.codigo.errors).toHaveProperty('pattern');
    form.controls.codigo.setValue('VISUAL');
    form.controls.descricao.setValue('   ');
    expect(form.controls.descricao.errors).toHaveProperty('pattern');
    form.controls.descricao.setValue('');
    expect(form.controls.descricao.errors).toHaveProperty('required');
  });

  it('prepara os comandos sem os brancos, com o id e a permanência só na atualização', () => {
    const valores = { nome: '  Visual ', codigo: 'VISUAL', descricao: ' Baixa visão ' };
    expect(comandoDeCriacao(valores)).toEqual({
      codigo: 'VISUAL',
      nome: 'Visual',
      descricao: 'Baixa visão',
    });
    expect(comandoDeAtualizacao('r1', valores, true)).toEqual({
      id: 'r1',
      codigo: 'VISUAL',
      nome: 'Visual',
      descricao: 'Baixa visão',
      permanente: true,
    });
    expect(comandoDeAtualizacao('r1', valores, null).permanente).toBeNull();
  });

  it('converte o campo recusado pelo servidor no controle do formulário', () => {
    expect(controleDoCampoDoServidor('Codigo')).toBe('codigo');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });

  describe('mensagem do campo', () => {
    const form = criarFormularioDeTipoDeficiencia();
    const tocar = (valor: string, nome: 'codigo' | 'nome' | 'descricao'): string | null => {
      form.controls[nome].setValue(valor);
      form.controls[nome].markAsTouched();
      return mensagemDoCampo(form.controls[nome], nome);
    };

    it('não mostra mensagem antes de o campo ser tocado ou editado', () => {
      const nome = criarFormularioDeTipoDeficiencia().controls.nome;
      expect(nome.invalid).toBe(true);
      expect(mensagemDoCampo(nome, 'nome')).toBeNull();
      nome.markAsTouched();
      expect(mensagemDoCampo(nome, 'nome')).toBe('Campo obrigatório.');
    });

    it('prioriza a recusa do servidor e a obrigatoriedade', () => {
      expect(tocar('', 'nome')).toBe('Campo obrigatório.');
      form.controls.nome.setErrors({ backend: { code: 'x', message: 'Nome recusado.' } });
      expect(mensagemDoCampo(form.controls.nome, 'nome')).toBe('Nome recusado.');
    });

    it('descreve o tamanho mínimo, o excesso e o formato do código', () => {
      expect(tocar('A', 'nome')).toBe('Informe ao menos 2 caracteres.');
      expect(tocar('x'.repeat(200), 'nome')).toBeNull();
      expect(tocar('x'.repeat(201), 'nome')).toBe('Valor acima do tamanho permitido.');
      expect(tocar('x'.repeat(1001), 'descricao')).toBe('Valor acima do tamanho permitido.');
      expect(tocar('9', 'codigo')).toContain('Informe ao menos');
      expect(tocar('9X', 'codigo')).toContain('Formato inválido');
      expect(tocar('A'.repeat(60), 'codigo')).toBe('Valor acima do tamanho permitido.');
    });

    it('explica que a descrição só com espaços não vale', () => {
      expect(tocar('   ', 'descricao')).toBe('Informe um texto — apenas espaços não valem.');
    });

    it('cai na mensagem genérica para outra regra violada', () => {
      const controle = new FormControl('x');
      controle.markAsTouched();
      controle.setErrors({ outra: true });
      expect(mensagemDoCampo(controle, 'nome')).toBe('Valor inválido.');
    });
  });
});
