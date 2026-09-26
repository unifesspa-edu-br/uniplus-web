import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { UiValorEmConsulta, ValorEmConsultaComponent } from './valor-em-consulta';

describe('ValorEmConsultaComponent', () => {
  let fixture: ComponentFixture<ValorEmConsultaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ValorEmConsultaComponent] });
    fixture = TestBed.createComponent(ValorEmConsultaComponent);
  });

  function render(entradas: Record<string, unknown>): HTMLElement {
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const textoDo = (host: HTMLElement, seletor: string): string =>
    host.querySelector(seletor)?.textContent?.trim() ?? '';

  it('associa o valor ao rótulo numa lista de descrição', () => {
    const host = render({ rotulo: 'Nome do processo seletivo', valor: 'Medicina 2027' });

    const par = host.querySelector('dl');
    expect(par?.querySelector('dt')?.textContent?.trim()).toBe('Nome do processo seletivo');
    expect(par?.querySelector('dd')?.textContent?.trim()).toBe('Medicina 2027');
  });

  it('não renderiza controle de formulário nem nada que receba foco', () => {
    const host = render({ rotulo: 'Valor da taxa', valor: '120,00' });

    expect(host.querySelector('input, select, textarea, button, [tabindex]')).toBeNull();
  });

  it.each<[UiValorEmConsulta, string]>([
    [true, 'Sim'],
    [false, 'Não'],
    [1.5, '1,5'],
    [1200, '1.200'],
    [0, '0'],
  ])('escreve %s como %s', (valor, esperado) => {
    const host = render({ rotulo: 'Campo', valor });

    expect(textoDo(host, 'dd')).toBe(esperado);
  });

  it.each<[UiValorEmConsulta]>([[null], [undefined], [''], ['   '], [[]], [['', ' ']]])(
    'diz que nada foi informado quando o valor é %j',
    (valor) => {
      const host = render({ rotulo: 'Campo', valor });

      expect(textoDo(host, '.valor-em-consulta__vazio')).toBe('Não informado');
    },
  );

  it('usa o texto de vazio que a tela declara', () => {
    const host = render({ rotulo: 'Fundamentos', valor: [], seVazio: 'Nenhum fundamento' });

    expect(textoDo(host, '.valor-em-consulta__vazio')).toBe('Nenhum fundamento');
  });

  it('lista cada item de um valor com várias escolhas', () => {
    const host = render({ rotulo: 'Recursos', valor: ['Prova ampliada', '', 'Ledor'] });

    const itens = [...host.querySelectorAll('dd li')].map((li) => li.textContent?.trim());
    expect(itens).toEqual(['Prova ampliada', 'Ledor']);
  });

  it('numera a lista cuja ordem importa', () => {
    const host = render({ rotulo: 'Áreas', valor: ['Redação', 'Matemática'], ordenada: true });

    expect(host.querySelector('ul')).toBeNull();
    const itens = Array.from(host.querySelectorAll('dd ol li'), (li) => li.textContent?.trim());
    expect(itens).toEqual(['Redação', 'Matemática']);
  });

  it('com rotuladoPor, usa o título da tela como rótulo e não o repete', () => {
    const host = render({ rotuladoPor: 'secao-recursos', valor: ['Ledor'], rotulo: 'Ignorado' });

    expect(host.querySelector('dl, dt')).toBeNull();
    const grupo = host.querySelector('[role="group"]');
    expect(grupo?.getAttribute('aria-labelledby')).toBe('secao-recursos');
    expect(grupo?.querySelector('li')?.textContent?.trim()).toBe('Ledor');
  });

  it('mostra a dica de leitura abaixo do valor', () => {
    const host = render({ rotulo: 'Origem', valor: 'Importação externa', dica: 'Vêm do SiSU.' });

    expect(textoDo(host, '.field__hint')).toBe('Vêm do SiSU.');
  });

  it('não corta o texto: o valor longo segue inteiro no DOM', () => {
    const longo = 'Unidade '.repeat(40).trim();
    const host = render({ rotulo: 'Unidade', valor: longo });

    expect(textoDo(host, 'dd')).toBe(longo);
  });
});
