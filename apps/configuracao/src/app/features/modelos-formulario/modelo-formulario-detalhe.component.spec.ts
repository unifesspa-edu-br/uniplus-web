import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioDetalheComponent } from './modelo-formulario-detalhe.component';

const conteudo = {
  titulo: 'Inscrição',
  etapas: [],
  itens: [],
  termos: [],
  pressupostos: [],
  grupos: [],
  documentosExigidos: [],
};
const modelo: ModeloFormularioView = {
  id: 'm1',
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo,
};

describe('ModeloFormularioDetalheComponent', () => {
  let fixture: ComponentFixture<ModeloFormularioDetalheComponent>;
  let componente: ModeloFormularioDetalheComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModeloFormularioDetalheComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ModeloFormularioDetalheComponent);
    componente = fixture.componentInstance;
    const entradas: Record<string, unknown> = {
      modelo: null,
      carregando: false,
      erroAoCarregar: null,
      fatos: [],
      catalogoComErro: false,
      tiposDeProcesso: [],
      fases: [],
      tiposDeDocumento: [],
      vocabularioDosDocumentosComErro: false,
      termosDisponiveis: [],
      termosComErro: false,
      form: new FormGroup({
        nome: new FormControl('', { nonNullable: true }),
        descricao: new FormControl('', { nonNullable: true }),
        tipoProcessoCodigo: new FormControl('', { nonNullable: true }),
      }),
      conteudo: null,
      salvando: false,
      somenteLeitura: false,
      tentando: { modelo: false, termos: false, catalogo: false, vocabulario: false },
      recusas: null,
      recusasGerais: [],
      recusasDosDocumentos: { porDocumento: new Map(), gerais: [] },
      comMunicipios: false,
    };
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  });

  it('sem conteúdo carregado, não há documentos exigidos nem fatos citáveis', () => {
    expect(componente.documentosExigidos()).toEqual([]);
    expect(componente.fatosCitaveisDosDocumentos().size).toBe(0);
  });

  it('um conteúdo sem a lista de documentos conta como sem documentos exigidos', () => {
    fixture.componentRef.setInput('conteudo', { ...conteudo, documentosExigidos: undefined });

    expect(componente.documentosExigidos()).toEqual([]);
  });

  it('o conteúdo só conta como alterado quando difere do modelo gravado', () => {
    fixture.componentRef.setInput('modelo', modelo);
    fixture.componentRef.setInput('conteudo', conteudo);
    expect(componente.conteudoAlterado()).toBe(false);

    fixture.componentRef.setInput('conteudo', { ...conteudo, titulo: 'Outro título' });
    expect(componente.conteudoAlterado()).toBe(true);
  });

  it('antes de o conteúdo ser preenchido, o modelo gravado já difere do vazio', () => {
    fixture.componentRef.setInput('modelo', modelo);

    expect(componente.conteudoAlterado()).toBe(true);
  });

  it('sem modelo, nada difere de um conteúdo ausente', () => {
    expect(componente.conteudoAlterado()).toBe(false);
  });

  it('o rótulo da finalidade volta ao valor quando ela não está no catálogo', () => {
    expect(componente.rotuloDaFinalidade('INSCRICAO')).not.toBe('INSCRICAO');
    expect(componente.rotuloDaFinalidade('OUTRA')).toBe('OUTRA');
  });
});
