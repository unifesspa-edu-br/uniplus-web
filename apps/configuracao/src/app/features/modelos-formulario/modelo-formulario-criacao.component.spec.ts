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

describe('declaração do modelo na criação', () => {
  const caixa = (fixture: ReturnType<typeof montarCriacao>, campo: string): HTMLInputElement =>
    fixture.nativeElement.querySelector(`input[type="checkbox"][formControlName="${campo}"]`);

  it('oferece as duas escolhas, rotuladas e desmarcadas', () => {
    const fixture = montarCriacao();

    expect(caixa(fixture, 'serveAFaseDeInscricao').closest('label')?.textContent).toContain(
      'Serve à fase de inscrição',
    );
    expect(caixa(fixture, 'obrigatorio').closest('label')?.textContent).toContain(
      'Preenchimento obrigatório',
    );
    expect(caixa(fixture, 'serveAFaseDeInscricao').checked).toBe(false);
    expect(caixa(fixture, 'obrigatorio').checked).toBe(false);
  });

  it('leva a escolha marcada ao formulário', () => {
    const fixture = montarCriacao();

    caixa(fixture, 'serveAFaseDeInscricao').click();

    expect(fixture.componentInstance.form().controls.serveAFaseDeInscricao.value).toBe(true);
    expect(fixture.componentInstance.form().controls.obrigatorio.value).toBe(false);
  });
});
