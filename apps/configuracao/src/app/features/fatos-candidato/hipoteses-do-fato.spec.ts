import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import {
  ClassificacaoDeProtecaoCodigo,
  HipoteseLegalTratamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import { criarFormularioDeFato, ligarDependenciasDaCriacao } from './fato-candidato-form';
import { hipotesesDoFato } from './fato-candidato.regras';
import {
  criarFormularioDaDefinicao,
  ligarDependenciasDaDefinicao,
} from './fato-candidato-edicao-form';

const itens = [
  { codigo: HipoteseLegalTratamentoCodigo.INTERESSE_LEGITIMO, rotulo: 'Rótulo publicado' },
  { codigo: HipoteseLegalTratamentoCodigo.PREVENCAO_A_FRAUDE, rotulo: 'Prevenção publicada' },
];

describe('hipóteses legais do fato', () => {
  it('filtra pelos códigos e apresenta os rótulos publicados', () => {
    expect(hipotesesDoFato(ClassificacaoDeProtecaoCodigo.PESSOAL, itens)).toEqual([
      { valor: HipoteseLegalTratamentoCodigo.INTERESSE_LEGITIMO, rotulo: 'Rótulo publicado' },
    ]);
    expect(hipotesesDoFato(ClassificacaoDeProtecaoCodigo.SENSIVEL, itens)).toEqual([
      { valor: HipoteseLegalTratamentoCodigo.PREVENCAO_A_FRAUDE, rotulo: 'Prevenção publicada' },
    ]);
  });

  it('preserva a escolha sem lista e limpa a opção incompatível após a leitura', () => {
    const formulario = criarFormularioDeFato();
    const dependencias = runInInjectionContext(TestBed.inject(Injector), () =>
      ligarDependenciasDaCriacao(formulario, signal([])),
    );
    formulario.patchValue({
      tipo: 'DECLARADO',
      dominio: 'SIM_OU_NAO',
      classificacaoProtecao: 'SENSIVEL',
      hipoteseLegal: 'INTERESSE_LEGITIMO',
    });
    TestBed.tick();
    expect(formulario.controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');
    dependencias.vocabularioDasHipoteses.set(itens);
    TestBed.tick();
    expect(formulario.controls.hipoteseLegal.value).toBe('');
  });

  it('preserva a hipótese na definição enquanto a lista está indisponível', () => {
    const formulario = criarFormularioDaDefinicao();
    runInInjectionContext(TestBed.inject(Injector), () =>
      ligarDependenciasDaDefinicao(formulario, signal(null), signal('DECLARADO'), signal([])),
    );
    formulario.patchValue({
      dominio: 'SIM_OU_NAO',
      classificacaoProtecao: 'SENSIVEL',
      hipoteseLegal: 'INTERESSE_LEGITIMO',
    });
    TestBed.tick();
    expect(formulario.controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');
  });
});
