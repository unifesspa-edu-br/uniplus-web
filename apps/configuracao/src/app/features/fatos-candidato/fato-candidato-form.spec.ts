import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
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
    ligarDependenciasDaCriacao(form),
  );
  return { form, dep };
};

describe('o formulário de criação do fato', () => {
  it('limita todos os campos de texto ao tamanho da API', () => {
    const { form } = ligado();
    const acima = (n: number): string => 'a'.repeat(n + 1);
    const no = (n: number): string => 'a'.repeat(n);

    form.controls.nome.setValue(acima(LIMITES_DO_FATO.nome));
    form.controls.descricao.setValue(acima(LIMITES_DO_FATO.descricao));
    form.controls.finalidadeTratamento.setValue(acima(LIMITES_DO_FATO.finalidadeTratamento));
    expect(form.controls.nome.hasError('maxlength')).toBe(true);
    expect(form.controls.descricao.hasError('maxlength')).toBe(true);
    expect(form.controls.finalidadeTratamento.hasError('maxlength')).toBe(true);

    form.controls.nome.setValue(no(LIMITES_DO_FATO.nome));
    form.controls.descricao.setValue(no(LIMITES_DO_FATO.descricao));
    form.controls.finalidadeTratamento.setValue(no(LIMITES_DO_FATO.finalidadeTratamento));
    expect(form.controls.nome.hasError('maxlength')).toBe(false);
    expect(form.controls.descricao.hasError('maxlength')).toBe(false);
    expect(form.controls.finalidadeTratamento.hasError('maxlength')).toBe(false);
  });

  it('o código segue o formato de caixa alta, e a mensagem diz qual regra foi violada', () => {
    const { form } = ligado();
    form.controls.codigo.setValue('minúsculo');
    form.controls.codigo.markAsTouched();

    expect(mensagemDoCampo(form.controls.codigo)).toBe(
      'Use caixa alta, começando por letra, com letras, números e sublinhado.',
    );
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

  it('a hipótese e a classificação fora das opções se esvaziam ao trocar o que as determina', () => {
    const { form } = ligado();
    form.patchValue({
      tipo: 'DECLARADO',
      dominio: 'BOOLEANO',
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
    form.patchValue({ tipo: 'DECLARADO', dominio: 'BOOLEANO' });
    TestBed.tick();
    expect(form.controls.fatoDeMembro.hasError('required')).toBe(false);
    expect(form.controls.fonteValores.hasError('required')).toBe(false);

    form.patchValue({ dominio: 'CATEGORICO' });
    TestBed.tick();
    expect(form.controls.fonteValores.hasError('required')).toBe(true);

    form.patchValue({ tipo: 'AGREGADO' });
    TestBed.tick();
    expect(form.controls.fatoDeMembro.hasError('required')).toBe(true);
  });
});
