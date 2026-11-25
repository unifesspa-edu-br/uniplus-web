import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import { TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeTipoProcesso,
  mensagemDoCampo,
  valoresDoTipoProcesso,
  valoresEmBrancoDoTipoProcesso,
} from './tipo-processo-form';

const tipo: TipoProcessoDto = {
  id: '1',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: null,
  ativo: true,
  criadoEm: '',
};

describe('formulário de tipo de processo', () => {
  it('nasce inválido e exige código com formato e tamanho, e nome', () => {
    const form = criarFormularioDeTipoProcesso();
    form.reset(valoresEmBrancoDoTipoProcesso());
    expect(form.invalid).toBe(true);
    form.patchValue({ codigo: 'A', nome: 'Nome' });
    expect(form.controls.codigo.valid).toBe(true);
    form.patchValue({ codigo: '1A' });
    expect(form.controls.codigo.hasError('pattern')).toBe(true);
    form.patchValue({ codigo: 'ENEM', nome: 'x'.repeat(201) });
    expect(form.controls.nome.hasError('maxlength')).toBe(true);
    form.patchValue({ nome: 'ENEM', descricao: 'x'.repeat(1001) });
    expect(form.controls.descricao.hasError('maxlength')).toBe(true);
    form.controls.descricao.setValue('');
    expect(form.valid).toBe(true);
  });

  it('carrega o tipo no formulário e apara os textos nos comandos, sem o código na atualização', () => {
    const form = criarFormularioDeTipoProcesso();
    form.reset(valoresDoTipoProcesso(tipo));
    expect(form.getRawValue()).toEqual({ codigo: 'SISU', nome: 'SiSU', descricao: '' });
    form.patchValue({ codigo: ' NOVA ', nome: ' Nome ', descricao: '  ' });
    expect(comandoDeCriacao(form)).toEqual({ codigo: ' NOVA ', nome: 'Nome', descricao: null });
    expect(comandoDeAtualizacao('1', form)).toEqual({ id: '1', nome: 'Nome', descricao: null });
  });

  it('liga o campo recusado pelo servidor ao controle, ignorando o desconhecido', () => {
    expect(controleDoCampoDoServidor('Descricao')).toBe('descricao');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });

  it('orienta o formato do código só depois de o campo ser tocado', () => {
    const { codigo } = criarFormularioDeTipoProcesso().controls;
    codigo.setValue('1A');
    expect(mensagemDoCampo(codigo)).toBeNull();
    codigo.markAsTouched();
    expect(mensagemDoCampo(codigo)).toBe(textoDoFormatoDoCodigo(80));
  });
});

describe('limites do código (80 caracteres)', () => {
  it.each(['A', 'A'.repeat(80)])('aceita o código válido %s', (valor) => {
    const codigo = criarFormularioDeTipoProcesso().controls.codigo;
    codigo.setValue(valor);
    expect(codigo.valid).toBe(true);
  });

  it.each([
    ['', 'required'],
    ['A'.repeat(81), 'maxlength'],
  ] as const)('recusa o código %s por %s', (valor, erro) => {
    const codigo = criarFormularioDeTipoProcesso().controls.codigo;
    codigo.setValue(valor);
    expect(codigo.hasError(erro)).toBe(true);
  });

  it.each(['a', ' A', 'A ', '1A', 'A__B', 'A_'])(
    'preserva e recusa o código fora do formato %s',
    (valor) => {
      const codigo = criarFormularioDeTipoProcesso().controls.codigo;
      codigo.setValue(valor);
      expect(codigo.hasError('pattern')).toBe(true);
      expect(codigo.value).toBe(valor);
    },
  );
});
