import { FinalidadeDoFormulario, type DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario } from './formulario.adaptador';

const INSCRICAO = FinalidadeDoFormulario.INSCRICAO;

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return Object.values(FinalidadeDoFormulario).reduce((atual, finalidade) => {
    const valores = valoresDoFormulario(atual, finalidade);
    return valores === undefined ? atual : edicaoDoPasso(finalidade, valores)(atual);
  }, documento);
}

describe('adaptador do passo Formulários', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
    expect(idaEVolta(documento)).toBe(documento);
  });

  it('lê o cabeçalho e a referência temporal da finalidade', () => {
    const valores = valoresDoFormulario(exemploDoContrato('inscricao-pelo-sistema'), INSCRICAO);

    expect(valores).toEqual({
      formulario: {
        titulo: 'Formulário de inscrição',
        faseChave: 'inscricao',
        modeloOrigemCodigo: '',
      },
      referenciaTemporal: { tipo: 'FIM_INSCRICAO', data: '', faseChave: '' },
    });
  });

  it('documento sem formulários nada lê e nada cria', () => {
    const documento = documentoSemNada();

    expect(valoresDoFormulario(documento, INSCRICAO)).toBeUndefined();
    expect(idaEVolta(documento)).toBe(documento);
  });

  it('o conteúdo e as regras de derivação ficam intactos quando só o título muda', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = valoresDoFormulario(documento, INSCRICAO);
    if (valores === undefined) throw new Error('O exemplo tem o formulário.');

    const editado = edicaoDoPasso(INSCRICAO, {
      ...valores,
      formulario: { ...valores.formulario, titulo: 'Novo' },
    })(documento);

    const [antes] = documento.formularios ?? [];
    const [depois] = editado.formularios ?? [];
    expect(depois.titulo).toBe('Novo');
    expect(depois.etapas).toBe(antes.etapas);
    expect(depois.itens).toBe(antes.itens);
    expect(depois.grupos).toBe(antes.grupos);
    expect(depois.termos).toBe(antes.termos);
    expect(editado.coleta?.regrasDerivacao).toBe(documento.coleta?.regrasDerivacao);
  });

  it('o modelo de origem é só leitura: não volta ao documento editado', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = valoresDoFormulario(documento, INSCRICAO);
    if (valores === undefined) throw new Error('O exemplo tem o formulário.');

    const editado = edicaoDoPasso(INSCRICAO, {
      ...valores,
      formulario: { ...valores.formulario, modeloOrigemCodigo: 'OUTRO' },
    })(documento);

    expect(editado).toBe(documento);
  });
});
