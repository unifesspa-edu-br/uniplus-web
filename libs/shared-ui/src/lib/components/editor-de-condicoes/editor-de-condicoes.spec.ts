import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EditorDeCondicoesComponent } from './editor-de-condicoes';
import {
  clausulasDe,
  comClausulaEm,
  fatoEscolhivel,
  fatosEscolhiveis,
  problemasDeCondicoes,
  semCondicaoEm,
  type CondicaoEmClausula,
  type FatoDoCatalogo,
  type FatoEscolhivel,
} from './condicoes-de-fatos';

const CATALOGO: readonly FatoDoCatalogo[] = [
  {
    codigo: 'SEXO',
    nome: 'Sexo',
    dominio: 'CATEGORICO',
    valoresDominio: ['FEMININO', 'MASCULINO', 'INTERSEXO'],
    binding: 'CAMPO_FORMULARIO:SEXO',
  },
  { codigo: 'PCD', nome: 'Pessoa com deficiência', dominio: 'BOOLEANO', binding: 'CAMPO_INSCRICAO:PCD' },
  { codigo: 'FAIXA_ETARIA', nome: 'Faixa etária', dominio: 'NUMERICO', binding: 'ATRIBUTO_CANDIDATO:IDADE' },
  { codigo: 'MODALIDADE', nome: 'Modalidade', dominio: 'CATEGORICO', valoresDominio: null, binding: 'REGRA_DERIVACAO:MODALIDADE' },
  { codigo: 'NOME', nome: 'Nome', dominio: 'TEXTO', binding: 'CAMPO_FORMULARIO:NOME' },
];

const FATOS: readonly FatoEscolhivel[] = fatosEscolhiveis(CATALOGO, new Map(), ['MODALIDADE']);

function condicao(clausula: number, fato: string, operador = 'IGUAL', valor = ''): CondicaoEmClausula {
  return { clausula, fato, operador, valor };
}

describe('o catálogo na forma que o editor oferece', () => {
  it('aceita os dois prefixos de campo do formulário como coletáveis', () => {
    expect(fatoEscolhivel(CATALOGO[0])?.coletavel).toBe(true);
    expect(fatoEscolhivel(CATALOGO[1])?.coletavel).toBe(true);
    expect(fatoEscolhivel(CATALOGO[2])?.coletavel).toBe(false);
  });

  it('não oferece domínio que o editor não sabe escrever, nem o fato omitido', () => {
    expect(FATOS.map((fato) => fato.codigo)).toEqual(['SEXO', 'PCD', 'FAIXA_ETARIA']);
  });
});

describe('as alternativas do predicado', () => {
  it('a nova alternativa leva o recorte, que o editor não mostra', () => {
    const lista = [condicao(1, 'MODALIDADE', 'EM', '["AC"]'), condicao(1, 'PCD')];

    const nova = comClausulaEm(lista, FATOS[0], 'MODALIDADE');

    expect(nova.map((item) => [item.clausula, item.fato])).toEqual([
      [1, 'MODALIDADE'],
      [1, 'PCD'],
      [2, 'SEXO'],
      [2, 'MODALIDADE'],
    ]);
    expect(clausulasDe(nova, 'MODALIDADE').map((clausula) => clausula.numero)).toEqual([1, 2]);
  });

  it('a alternativa que fica sem condição some e as demais renumeram', () => {
    const lista = [condicao(1, 'PCD'), condicao(2, 'SEXO'), condicao(3, 'FAIXA_ETARIA')];

    expect(semCondicaoEm(lista, 1).map((item) => item.clausula)).toEqual([1, 2]);
  });

  it('confere cada condição e pula as que outro controle confere', () => {
    const porCodigo = new Map(FATOS.map((fato) => [fato.codigo, fato]));
    const lista = [condicao(1, 'PCD'), condicao(1, 'MODALIDADE')];

    expect(problemasDeCondicoes(lista, porCodigo, new Map(), ['MODALIDADE'])).toEqual([
      '"Pessoa com deficiência" está sem valor',
    ]);
  });
});

@Component({
  standalone: true,
  imports: [EditorDeCondicoesComponent],
  template: `
    <ui-editor-de-condicoes
      legenda="Condições do teste"
      idBase="teste"
      fatoDoRecorte="MODALIDADE"
      [condicoes]="condicoes()"
      [fatos]="fatos()"
      [erros]="erros()"
      (condicoesChange)="condicoes.set($event)"
    />
  `,
})
class HospedeiroDeTeste {
  readonly condicoes = signal<readonly CondicaoEmClausula[]>([condicao(1, 'PCD')]);
  readonly fatos = signal<readonly FatoEscolhivel[]>(FATOS);
  readonly erros = signal<Readonly<Record<number, string>>>({});
}

describe('EditorDeCondicoesComponent', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;
  let raiz: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HospedeiroDeTeste] }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  });

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(raiz.querySelectorAll('button')).find((item) =>
      (item.textContent ?? '').includes(texto),
    );
    expect(achado, `botão "${texto}"`).toBeDefined();
    return achado as HTMLButtonElement;
  }

  function escolher(seletor: string, valor: string): void {
    const campo = raiz.querySelector(seletor) as HTMLSelectElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('todo controle tem rótulo associado e os ids não se repetem', () => {
    botao('Acrescentar alternativa').click();
    fixture.detectChanges();

    const controles = Array.from(raiz.querySelectorAll('select, input[type="text"]'));
    expect(controles.length).toBeGreaterThan(0);

    for (const controle of controles) {
      if (controle.getAttribute('role') === 'combobox') continue;
      expect(controle.id).not.toBe('');
      expect(raiz.querySelector(`label[for="${controle.id}"]`), controle.id).not.toBeNull();
    }

    const ids = Array.from(raiz.querySelectorAll('[id]'), (elemento) => elemento.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('o conjunto é um fieldset com legenda, e as ações são botões nativos', () => {
    expect(raiz.querySelector('fieldset > legend')?.textContent).toContain('Condições do teste');
    for (const item of Array.from(raiz.querySelectorAll('button'))) {
      expect(item.type).toBe('button');
    }
  });

  it('escolher o valor devolve a lista inteira, com o valor no wire', () => {
    escolher('#teste-0-valor', 'true');

    expect(fixture.componentInstance.condicoes()).toEqual([condicao(1, 'PCD', 'IGUAL', 'true')]);
  });

  it('trocar o fato recomeça operador e valor, mantendo a cláusula', () => {
    escolher('#teste-0-valor', 'true');
    escolher('#teste-0-fato', 'SEXO');

    expect(fixture.componentInstance.condicoes()).toEqual([condicao(1, 'SEXO')]);
  });

  it('anuncia o que a condição alcança como status, ligado ao controle de valor', () => {
    escolher('#teste-0-valor', 'false');

    const nota = raiz.querySelector('#teste-0-alcance') as HTMLElement;
    expect(nota.getAttribute('role')).toBe('status');
    expect(nota.textContent).toContain('respondeu que não');
    expect(raiz.querySelector('#teste-0-valor')?.getAttribute('aria-describedby')).toBe(
      'teste-0-alcance',
    );
  });

  it('anuncia o erro como alert e marca o controle como inválido', () => {
    fixture.componentInstance.erros.set({ 0: 'está sem valor' });
    fixture.detectChanges();

    const erro = raiz.querySelector('#teste-0-erro') as HTMLElement;
    expect(erro.getAttribute('role')).toBe('alert');
    expect(erro.textContent).toContain('está sem valor');

    const valor = raiz.querySelector('#teste-0-valor') as HTMLElement;
    expect(valor.getAttribute('aria-invalid')).toBe('true');
    expect(valor.getAttribute('aria-describedby')).toContain('teste-0-erro');
  });

  it('nomeia cada alternativa quando há mais de uma', () => {
    expect(raiz.querySelector('[role="group"]')?.getAttribute('aria-label')).toBeNull();

    botao('Acrescentar alternativa').click();
    fixture.detectChanges();

    const rotulos = Array.from(raiz.querySelectorAll('[role="group"]'), (grupo) =>
      grupo.getAttribute('aria-label'),
    );
    expect(rotulos).toEqual(['Alternativa 1', 'Alternativa 2']);
  });

  it('remover a única condição deixa o texto de vazio', () => {
    botao('Remover condição').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.condicoes()).toEqual([]);
    expect(raiz.textContent).toContain('Nenhuma condição declarada.');
  });

  it('sem catálogo, avisa e não deixa acrescentar', () => {
    fixture.componentInstance.fatos.set([]);
    fixture.detectChanges();

    expect(raiz.textContent).toContain('catálogo de fatos do candidato não foi carregado');
    expect(botao('Acrescentar alternativa').disabled).toBe(true);
  });
});
