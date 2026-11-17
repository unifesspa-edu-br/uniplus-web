import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { EditorDeFormularioComponent, type FatoDoFormulario } from '@uniplus/shared-ui/components';
import { TipoDaObrigatoriedadeDoFormulario as Obrigatoriedade } from '@uniplus/shared-data/selecao';
import { conteudoDoDocumento, documentoDoConteudo } from './conversao-do-formulario';
import { aceita, formulario, CATALOGOS } from './conversao.testing';

const FATOS: readonly FatoDoFormulario[] = [
  {
    codigo: 'RENDA',
    nome: 'Renda',
    dominio: 'NUMERICO',
    cardinalidade: 'ESCALAR',
    binding: 'CAMPO_FORMULARIO:RENDA',
    fonteValores: null,
    escopo: 'CANDIDATO',
    ativo: true,
  },
  {
    codigo: 'PARENTESCO',
    nome: 'Parentesco',
    dominio: 'CATEGORICO',
    valoresDominio: ['PROPRIO_CANDIDATO'],
    cardinalidade: 'ESCALAR',
    binding: 'CAMPO_FORMULARIO:PARENTESCO',
    fonteValores: null,
    escopo: 'MEMBRO_GRUPO',
    ativo: true,
  },
];

describe('edição do documento pelo editor', () => {
  it('a inclusão do candidato grava também o parentesco já mostrado como sempre obrigatório', () => {
    const original = {
      ...formulario(),
      grupos: [
        { codigo: 'familia', etapaCodigo: 'dados', subitens: [{ fatoCodigo: 'PARENTESCO' }] },
      ],
    };
    let atual = aceita(conteudoDoDocumento(original, CATALOGOS));
    const fixture = TestBed.createComponent(EditorDeFormularioComponent);
    fixture.componentRef.setInput('conteudo', atual.conteudo);
    fixture.componentRef.setInput('catalogo', FATOS);
    fixture.componentRef.setInput('finalidade', 'INSCRICAO');
    fixture.componentInstance.edicao.subscribe((edicao) => {
      atual = aceita(documentoDoConteudo(atual, edicao, CATALOGOS));
      fixture.componentRef.setInput('conteudo', atual.conteudo);
    });
    fixture.detectChanges();
    const raiz: HTMLElement = fixture.nativeElement;
    const caixa = raiz.querySelector<HTMLInputElement>(
      'input[aria-describedby$="-candidato-nota"]',
    );
    expect(caixa).not.toBeNull();
    caixa?.click();
    fixture.detectChanges();
    expect(atual.formulario.grupos?.[0]).toMatchObject({
      minimo: 1,
      incluiCandidato: true,
      subitens: [
        { ordem: 0, precondicao: null, obrigatoriedade: { tipo: Obrigatoriedade.SEMPRE } },
      ],
    });
    expect(atual.formulario.grupos?.[0]).not.toHaveProperty('ordem');
    expect(atual.formulario.itens).toEqual(original.itens);
    expect(atual.formulario.termos).toEqual(original.termos);
  });
});
