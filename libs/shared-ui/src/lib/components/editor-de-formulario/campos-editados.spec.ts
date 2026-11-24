import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { COM_LISTA } from '../editor-de-condicoes/operadores-de-exemplo.testing';
import { EditorDeFormularioComponent } from './editor-de-formulario';
import type { EdicaoDoFormulario } from './modelo/campos-editados';
import type { ConteudoDoFormulario } from './modelo/tipos';

const conteudo: ConteudoDoFormulario = {
  titulo: null,
  pressupostos: [],
  termos: [],
  itens: [],
  etapas: [
    {
      codigo: 'secao',
      ordem: 0,
      tipo: 'SECAO',
      bloco: null,
      apresentacao: { titulo: 'Dados', descricao: null, aviso: null },
    },
  ],
  grupos: [
    {
      codigo: 'familia',
      ordem: 0,
      rotulo: 'Composição familiar',
      etapaCodigo: 'secao',
      ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
      regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
      subitens: [],
    },
  ],
};

function montar() {
  const fixture = TestBed.createComponent(EditorDeFormularioComponent);
  fixture.componentRef.setInput('conteudo', conteudo);
  fixture.componentRef.setInput('catalogo', []);
  fixture.componentRef.setInput('finalidade', 'INSCRICAO');
  const edicoes: EdicaoDoFormulario[] = [];
  const completos: ConteudoDoFormulario[] = [];
  fixture.componentInstance.edicao.subscribe((edicao) => edicoes.push(edicao));
  fixture.componentInstance.conteudoChange.subscribe((novo) => completos.push(novo));
  fixture.detectChanges();
  return { fixture, edicoes, completos };
}

describe('campos confirmados no editor', () => {
  it('identifica o mínimo confirmado em zero e conserva a saída de conteúdo completo', () => {
    const { fixture, edicoes, completos } = montar();
    const raiz: HTMLElement = fixture.nativeElement;
    const minimo = raiz.querySelector<HTMLInputElement>('[id$="-minimo"]');
    expect(minimo).not.toBeNull();
    minimo?.dispatchEvent(new Event('change'));
    expect(edicoes).toHaveLength(1);
    expect(edicoes[0].camposEditados).toEqual([['grupos', 'familia', 'ocorrencias', 'minimo']]);
    expect(edicoes[0].conteudo).toBe(completos[0]);
    expect(completos[0].grupos?.[0].ocorrencias.minimo).toBe(0);
  });

  it('a identificação da ação anterior não acompanha a edição seguinte', () => {
    const { fixture, edicoes } = montar();
    const raiz: HTMLElement = fixture.nativeElement;
    raiz.querySelector('[id$="-minimo"]')?.dispatchEvent(new Event('change'));
    raiz.querySelector('[id$="-titulo"]')?.dispatchEvent(new Event('input'));
    expect(edicoes[1].camposEditados).toEqual([['titulo']]);
  });
  it('a inclusão do candidato identifica também os campos confirmados no parentesco', () => {
    const { fixture, edicoes } = montar();
    fixture.componentRef.setInput('catalogo', [
      {
        codigo: 'PARENTESCO',
        nome: 'Parentesco',
        dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
        valoresDominio: ['PROPRIO_CANDIDATO'],
        operadoresAdmitidos: COM_LISTA,
        binding: 'CAMPO_FORMULARIO:PARENTESCO',
        cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'VALOR_UNICO' },
        fonteValores: null,
        escopo: 'MEMBRO_GRUPO',
        ativo: true,
      },
    ]);
    fixture.detectChanges();
    const raiz: HTMLElement = fixture.nativeElement;
    const caixa = raiz.querySelector<HTMLInputElement>(
      'input[aria-describedby$="-candidato-nota"]',
    );
    expect(caixa).not.toBeNull();
    if (caixa !== null) caixa.checked = true;
    caixa?.dispatchEvent(new Event('change'));
    expect(edicoes[0].camposEditados).toContainEqual([
      'grupos',
      'familia',
      'ocorrencias',
      'minimo',
    ]);
    expect(edicoes[0].camposEditados).toContainEqual([
      'grupos',
      'familia',
      'subitens',
      'PARENTESCO',
      'regras',
      'obrigatoriedade',
      'tipo',
    ]);
    expect(edicoes[0].conteudo.grupos?.[0].subitens[0].fatoCodigo).toBe('PARENTESCO');
  });
});
