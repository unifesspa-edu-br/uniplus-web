import { FINALIDADE_INSCRICAO } from './vocabulario-do-modelo.testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { conteudoDoModelo } from './conteudo-do-modelo';
import { ModeloFormularioRodapeComponent } from './modelo-formulario-rodape.component';

const conteudoGravado = {
  titulo: 'Inscrição',
  etapas: [],
  itens: [],
  termos: [],
  pressupostos: [],
  grupos: [],
  conjuntoDeDocumentos: { documentosExigidos: [], gruposDeDocumentos: [] },
};
const modelo: ModeloFormularioView = {
  id: 'm1',
  codigo: 'INSCRICAO',
  finalidade: FINALIDADE_INSCRICAO,
  ativo: true,
  descritivo: { nome: 'Inscrição', descricao: null, tipoProcessoCodigo: null },
  conteudo: conteudoGravado,
};
/** O conteúdo na forma que a tela edita, igual ao gravado. */
const conteudo = conteudoDoModelo(conteudoGravado);

describe('ModeloFormularioRodapeComponent', () => {
  let fixture: ComponentFixture<ModeloFormularioRodapeComponent>;
  let componente: ModeloFormularioRodapeComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModeloFormularioRodapeComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ModeloFormularioRodapeComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('modelo', modelo);
    fixture.componentRef.setInput('conteudo', conteudo);
    fixture.componentRef.setInput('salvando', false);
    fixture.componentRef.setInput('somenteLeitura', false);
    fixture.detectChanges();
  });

  it('o conteúdo só conta como alterado quando difere do modelo gravado', () => {
    expect(componente.conteudoAlterado()).toBe(false);

    fixture.componentRef.setInput('conteudo', { ...conteudo, titulo: 'Outro título' });
    expect(componente.conteudoAlterado()).toBe(true);
  });

  it('antes de o conteúdo ser preenchido, o modelo gravado já difere do vazio', () => {
    fixture.componentRef.setInput('conteudo', null);

    expect(componente.conteudoAlterado()).toBe(true);
  });

  it('o aviso de simulação só aparece com alteração não gravada', () => {
    expect(fixture.nativeElement.textContent).not.toContain('grave as alterações');

    fixture.componentRef.setInput('conteudo', { ...conteudo, titulo: 'Outro título' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('grave as alterações');
  });
});
