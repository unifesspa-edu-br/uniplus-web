import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ModeloFormularioCriacaoComponent } from './modelo-formulario-criacao.component';
import { criarFormularioDeModelo } from './modelo-formulario-form';

function montarCriacao() {
  const fixture = TestBed.createComponent(ModeloFormularioCriacaoComponent);
  for (const [nome, valor] of Object.entries(entradasDaCriacao()))
    fixture.componentRef.setInput(nome, valor);
  fixture.detectChanges();
  return fixture;
}

function entradasDaCriacao() {
  return {
    aberto: true,
    form: criarFormularioDeModelo(),
    salvando: false,
    erroDaCriacao: null,
    anuncio: '',
    tiposDeProcesso: [],
    leituraDosTipos: { visivel: signal(false) },
    modelos: [],
  };
}

describe('finalidades da criação do modelo', () => {
  it('oferece todas as finalidades com lista vazia e filtrada', () => {
    const fixture = montarCriacao();
    const opcoes = () =>
      fixture.nativeElement.querySelector('select[formControlName="finalidade"]')
        .textContent as string;
    expect(opcoes()).toContain('Habilitação');
    fixture.componentRef.setInput('modelos', [
      { finalidade: { codigo: 'INSCRICAO', rotulo: 'Inscrição' } },
    ]);
    fixture.detectChanges();
    expect(opcoes()).toContain('Isenção da taxa de inscrição');
    expect(opcoes()).toContain('Habilitação');
  });
});
