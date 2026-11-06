import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioDocumentosComponent } from './modelo-formulario-documentos.component';

const conteudo = {
  titulo: 'Inscrição',
  etapas: [],
  itens: [],
  termos: [],
  pressupostos: [],
  grupos: [],
  documentosExigidos: [],
};

describe('ModeloFormularioDocumentosComponent', () => {
  let fixture: ComponentFixture<ModeloFormularioDocumentosComponent>;
  let componente: ModeloFormularioDocumentosComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ModeloFormularioDocumentosComponent] });
    fixture = TestBed.createComponent(ModeloFormularioDocumentosComponent);
    componente = fixture.componentInstance;
    const entradas: Record<string, unknown> = {
      conteudo,
      fatos: [],
      fases: [],
      tiposDeDocumento: [],
      recusas: { porDocumento: new Map(), gerais: [] },
      somenteLeitura: false,
      comMunicipios: false,
    };
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  });

  it('sem termos no conteúdo, não há documentos exigidos nem fatos citáveis', () => {
    expect(componente.documentosExigidos()).toEqual([]);
    expect(componente.fatosCitaveis().size).toBe(0);
  });

  it('um conteúdo sem a lista de documentos conta como sem documentos exigidos', () => {
    fixture.componentRef.setInput('conteudo', { ...conteudo, documentosExigidos: undefined });

    expect(componente.documentosExigidos()).toEqual([]);
  });
});
