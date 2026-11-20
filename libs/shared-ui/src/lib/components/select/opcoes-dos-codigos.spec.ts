import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { CodigoComRotulo } from '../codigo-com-rotulo';
import { opcoesDosCodigos } from './opcoes-dos-codigos';
import { SelectComponent, type UiSelectOption } from './select';

enum TipoDeAtoCodigo {
  portaria = 'portaria',
  edital = 'edital',
  resolucao = 'resolucao',
}

type ValorDoVocabulario = CodigoComRotulo<TipoDeAtoCodigo> & { readonly descricao?: string };

const VOCABULARIO: readonly ValorDoVocabulario[] = [
  { codigo: TipoDeAtoCodigo.resolucao, rotulo: 'Resolução', descricao: 'Ato de um colegiado.' },
  { codigo: TipoDeAtoCodigo.portaria, rotulo: 'Portaria' },
  { codigo: TipoDeAtoCodigo.edital, rotulo: 'Edital', descricao: 'Ato que abre o processo.' },
];

describe('opcoesDosCodigos', () => {
  it('faz uma opção por valor, na ordem recebida, sem reordenar nem filtrar', () => {
    const codigos = opcoesDosCodigos(VOCABULARIO).map((opcao) => opcao.value);

    expect(codigos).toEqual([
      TipoDeAtoCodigo.resolucao,
      TipoDeAtoCodigo.portaria,
      TipoDeAtoCodigo.edital,
    ]);
  });

  it('usa o código como valor e o rótulo como texto da opção', () => {
    expect(opcoesDosCodigos([{ codigo: TipoDeAtoCodigo.portaria, rotulo: 'Portaria' }])).toEqual([
      { value: TipoDeAtoCodigo.portaria, label: 'Portaria' },
    ]);
  });

  it('a descrição do valor vira a descrição da opção', () => {
    const [resolucao] = opcoesDosCodigos(VOCABULARIO);

    expect(resolucao?.description).toBe('Ato de um colegiado.');
  });

  it('sem descrição, a opção não tem a chave de descrição', () => {
    const portaria = opcoesDosCodigos(VOCABULARIO)[1];

    expect(portaria).toBeDefined();
    expect(portaria && 'description' in portaria).toBe(false);
  });

  it('vocabulário vazio dá lista vazia', () => {
    expect(opcoesDosCodigos([])).toEqual([]);
  });

  it('um código que a API acrescenta aparece na lista, sem texto novo no web', () => {
    const comCodigoNovo: readonly CodigoComRotulo<string>[] = [
      ...VOCABULARIO,
      { codigo: 'instrucao_normativa', rotulo: 'Instrução normativa' },
    ];

    const opcoes = opcoesDosCodigos(comCodigoNovo);

    expect(opcoes).toHaveLength(VOCABULARIO.length + 1);
    expect(opcoes.at(-1)).toEqual({ value: 'instrucao_normativa', label: 'Instrução normativa' });
  });

  it('o valor da opção tem o tipo do código', () => {
    expectTypeOf(opcoesDosCodigos(VOCABULARIO)).toEqualTypeOf<
      readonly UiSelectOption<TipoDeAtoCodigo>[]
    >();
  });
});

describe('opcoesDosCodigos no ui-select', () => {
  let fixture: ComponentFixture<SelectComponent<TipoDeAtoCodigo>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectComponent<TipoDeAtoCodigo>);
    fixture.componentRef.setInput('fieldLabel', 'Tipo de ato');
    fixture.componentRef.setInput('placeholderText', 'Todos');
    fixture.componentRef.setInput('choices', opcoesDosCodigos(VOCABULARIO));
    fixture.detectChanges();
  });

  it('mostra os rótulos do vocabulário depois da opção que a tela acrescenta', () => {
    const textos = [...(fixture.nativeElement as HTMLElement).querySelectorAll('option')].map(
      (opcao) => opcao.textContent?.trim(),
    );

    expect(textos).toEqual(['Todos', 'Resolução', 'Portaria', 'Edital']);
  });

  it('mostra a descrição do vocabulário como apoio da opção escolhida', () => {
    fixture.componentInstance.writeValue(TipoDeAtoCodigo.edital);
    fixture.detectChanges();

    const apoio = (fixture.nativeElement as HTMLElement).querySelector('p.field__hint');
    expect(apoio?.textContent?.trim()).toBe('Ato que abre o processo.');
  });
});
