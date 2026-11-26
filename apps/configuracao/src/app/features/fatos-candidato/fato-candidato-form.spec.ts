import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  criarFormularioDaDefinicao,
  ligarDependenciasDaDefinicao,
  valoresDaDefinicao,
} from './fato-candidato-edicao-form';
import { trabalha } from './fatos-candidato.fixtures';
import {
  LIMITES_DO_FATO,
  controleDoCampoDoServidor,
  criarFormularioDeFato,
  ligarDependenciasDaCriacao,
  mensagemDoCampo,
} from './fato-candidato-form';

const ligado = () => {
  const form = criarFormularioDeFato();
  const dep = runInInjectionContext(TestBed.inject(Injector), () =>
    ligarDependenciasDaCriacao(form, signal([])),
  );
  return { form, dep };
};

describe('o formulário de criação do fato', () => {
  it('rejeita textos acima do limite da API', () => {
    const { form } = ligado();
    form.controls.nome.setValue('a'.repeat(LIMITES_DO_FATO.nome + 1));
    form.controls.descricao.setValue('a'.repeat(LIMITES_DO_FATO.descricao + 1));
    form.controls.finalidadeTratamento.setValue(
      'a'.repeat(LIMITES_DO_FATO.finalidadeTratamento + 1),
    );
    expect(form.controls.nome.hasError('maxlength')).toBe(true);
    expect(form.controls.descricao.hasError('maxlength')).toBe(true);
    expect(form.controls.finalidadeTratamento.hasError('maxlength')).toBe(true);
  });

  it('aceita textos no limite da API', () => {
    const { form } = ligado();
    form.controls.nome.setValue('a'.repeat(LIMITES_DO_FATO.nome));
    form.controls.descricao.setValue('a'.repeat(LIMITES_DO_FATO.descricao));
    form.controls.finalidadeTratamento.setValue('a'.repeat(LIMITES_DO_FATO.finalidadeTratamento));
    expect(form.controls.nome.hasError('maxlength')).toBe(false);
    expect(form.controls.descricao.hasError('maxlength')).toBe(false);
    expect(form.controls.finalidadeTratamento.hasError('maxlength')).toBe(false);
  });

  it('o código segue o formato de caixa alta, e a mensagem diz qual regra foi violada', () => {
    const { form } = ligado();
    form.controls.codigo.setValue('minúsculo');
    form.controls.codigo.markAsTouched();

    expect(mensagemDoCampo(form.controls.codigo)).toBe(textoDoFormatoDoCodigo(50));
    form.controls.codigo.setValue('PERFIL_2');
    expect(mensagemDoCampo(form.controls.codigo)).toBeNull();
  });

  it('só os campos do formulário recebem a recusa do servidor; o resto fica para o alerta', () => {
    expect(controleDoCampoDoServidor('PontoResolucao')).toBe('pontoResolucao');
    expect(controleDoCampoDoServidor('fatoDeMembro')).toBe('fatoDeMembro');
    expect(controleDoCampoDoServidor('tipo')).toBeNull();
    expect(controleDoCampoDoServidor('citacoes.modelos.X')).toBeNull();
  });

  it('trocar para o derivado esvazia o tipo de dado que ele não aceita', () => {
    const { form, dep } = ligado();
    form.patchValue({ tipo: 'DECLARADO', dominio: 'TEXTO' });
    TestBed.tick();
    expect(form.controls.dominio.value).toBe('TEXTO');

    form.patchValue({ tipo: 'DERIVADO' });
    TestBed.tick();

    expect(form.controls.dominio.value).toBe('');
    expect(dep.declarado()).toBe(false);
  });

  it('mantém opção ao trocar para derivado com a lista vazia', () => {
    const { form } = ligado();
    form.patchValue({ dominio: 'OPCAO', tipo: 'DERIVADO' });
    TestBed.tick();
    expect(form.controls.dominio.value).toBe('OPCAO');
  });

  it('a hipótese e a classificação fora das opções se esvaziam ao trocar o que as determina', () => {
    const { form, dep } = ligado();
    dep.vocabularioDasHipoteses.set([
      { codigo: 'INTERESSE_LEGITIMO', rotulo: 'Interesse legítimo' },
    ]);
    form.patchValue({
      tipo: 'DECLARADO',
      dominio: 'SIM_OU_NAO',
      classificacaoProtecao: 'PESSOAL',
      hipoteseLegal: 'INTERESSE_LEGITIMO',
    });
    TestBed.tick();

    form.controls.classificacaoProtecao.setValue('SENSIVEL');
    TestBed.tick();

    expect(form.controls.hipoteseLegal.value).toBe('');
  });

  it('exige o fato de membro só no agregado, e fonte e formato só nos tipos de dado que os têm', () => {
    const { form } = ligado();
    form.patchValue({ tipo: 'DECLARADO', dominio: 'SIM_OU_NAO' });
    TestBed.tick();
    expect(form.controls.fatoDeMembro.hasError('required')).toBe(false);
    expect(form.controls.fonteValores.hasError('required')).toBe(false);

    form.patchValue({ dominio: 'OPCAO' });
    TestBed.tick();
    expect(form.controls.fonteValores.hasError('required')).toBe(true);
  });

  it('exige o fato de membro no agregado', () => {
    const { form } = ligado();
    form.patchValue({ tipo: 'AGREGADO' });
    TestBed.tick();
    expect(form.controls.fatoDeMembro.hasError('required')).toBe(true);
  });
});

describe('o formulário da definição', () => {
  it('preserva o tipo e o rótulo do fato enquanto a lista está vazia', () => {
    const form = criarFormularioDaDefinicao();
    form.patchValue(valoresDaDefinicao(trabalha));
    const dep = runInInjectionContext(TestBed.inject(Injector), () =>
      ligarDependenciasDaDefinicao(form, signal(trabalha), signal('DECLARADO'), signal([])),
    );
    TestBed.tick();
    expect(form.controls.dominio.value).toBe(trabalha.definicao.dominio.codigo);
    expect(dep.dominios()).toEqual([trabalha.definicao.dominio]);
  });
});
