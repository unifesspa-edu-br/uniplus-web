import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { mockCausaGeral, mockValidationError } from '@uniplus/shared-testing';

import {
  RecusasDaConferenciaComponent,
  recusasDaConferencia,
  type RecusaDaConferencia,
} from './recusas-da-conferencia';

describe('recusasDaConferencia', () => {
  it('mantém a ordem recebida e não junta recusas de mesmo texto', () => {
    const recusas = recusasDaConferencia([
      mockValidationError({ message: 'O item é inválido.', field: 'paginas[0].itens[1]' }),
      mockValidationError({ message: 'O item é inválido.', field: 'paginas[2].itens[0]' }),
    ]);

    expect(recusas).toEqual([
      { mensagem: 'O item é inválido.', campo: 'paginas[0].itens[1]' },
      { mensagem: 'O item é inválido.', campo: 'paginas[2].itens[0]' },
    ]);
  });

  it('a causa sem campo ou com o campo vazio não diz onde', () => {
    const recusas = recusasDaConferencia([
      mockCausaGeral({ message: 'Há código repetido.' }),
      mockValidationError({ message: 'Raiz recusada.', field: '' }),
    ]);

    expect(recusas.map((recusa) => recusa.campo)).toEqual([null, null]);
  });

  it('sem causas devolve lista vazia', () => {
    expect(recusasDaConferencia(undefined)).toEqual([]);
  });
});

describe('RecusasDaConferenciaComponent', () => {
  let fixture: ComponentFixture<RecusasDaConferenciaComponent>;

  const montar = (recusas: readonly RecusaDaConferencia[]): HTMLElement => {
    fixture = TestBed.createComponent(RecusasDaConferenciaComponent);
    fixture.componentRef.setInput('recusas', recusas);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const itens = (tela: HTMLElement): HTMLElement[] =>
    [...tela.querySelectorAll('ul > li')] as HTMLElement[];

  it('lista cada recusa com a sua mensagem e o seu campo, e diz o total no título', () => {
    const tela = montar([
      { mensagem: 'Primeira recusa.', campo: 'paginas[0].itens[2]' },
      { mensagem: 'Segunda recusa.', campo: 'paginas[1]' },
      { mensagem: 'Terceira recusa.', campo: null },
    ]);

    expect(tela.querySelector('[role="heading"]')?.textContent).toContain('3 recusas');
    expect(itens(tela)).toHaveLength(3);
    expect(itens(tela)[0].textContent).toContain('Primeira recusa.');
    expect(itens(tela)[0].textContent).toContain('Onde: paginas[0].itens[2]');
    expect(itens(tela)[1].textContent).toContain('Onde: paginas[1]');
  });

  it('a recusa sem campo mostra só a mensagem, sem "Onde"', () => {
    const tela = montar([{ mensagem: 'Há código repetido.', campo: null }]);

    expect(itens(tela)[0].textContent).toContain('Há código repetido.');
    expect(itens(tela)[0].textContent).not.toContain('Onde');
  });

  it('com uma só recusa, o total fica no singular', () => {
    const tela = montar([{ mensagem: 'Única.', campo: null }]);

    expect(tela.querySelector('[role="heading"]')?.textContent).toContain('1 recusa');
    expect(tela.querySelector('[role="heading"]')?.textContent).not.toContain('1 recusas');
  });

  it('duas recusas de mesmo texto e campos diferentes aparecem as duas', () => {
    const tela = montar([
      { mensagem: 'Item inválido.', campo: 'itens[0]' },
      { mensagem: 'Item inválido.', campo: 'itens[3]' },
    ]);

    expect(itens(tela)).toHaveLength(2);
    expect(itens(tela)[1].textContent).toContain('Onde: itens[3]');
  });

  it('é uma lista de verdade, com o título como nome da região, e leva o foco ao título', async () => {
    const tela = montar([{ mensagem: 'Recusa.', campo: null }]);
    await fixture.whenStable();

    const titulo = tela.querySelector('[role="heading"]') as HTMLElement;
    expect(tela.querySelector('ul')).not.toBeNull();
    expect(tela.querySelector('section')?.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(document.activeElement).toBe(titulo);
  });

  it('uma lista nova leva o foco de volta ao título, mesmo com o componente reaproveitado', async () => {
    const tela = montar([{ mensagem: 'Antiga.', campo: null }]);
    await fixture.whenStable();
    (document.activeElement as HTMLElement).blur();

    fixture.componentRef.setInput('recusas', [{ mensagem: 'Nova.', campo: null }]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(tela.querySelector('[role="heading"]'));
  });
});
