import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecusaDoCampo, RecusaDoCampoComponent } from './recusa-do-campo';

const COM_PAGINA: RecusaDoCampo = {
  codigo: 'uniplus.selecao.edital.vigencia_invalida',
  mensagem: 'A vigência termina antes de começar.',
  pagina: 'https://exemplo.unifesspa.edu.br/erros/uniplus.selecao.edital.vigencia_invalida',
};

const SEM_PAGINA: RecusaDoCampo = {
  codigo: 'uniplus.selecao.edital.titulo_repetido',
  mensagem: 'Já existe um edital com este título.',
  pagina: null,
};

describe('RecusaDoCampoComponent', () => {
  let fixture: ComponentFixture<RecusaDoCampoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RecusaDoCampoComponent] });
    fixture = TestBed.createComponent(RecusaDoCampoComponent);
  });

  function render(recusas: readonly RecusaDoCampo[]): HTMLElement {
    fixture.componentRef.setInput('recusas', recusas);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sem recusas, não renderiza nada', () => {
    expect(render([]).children).toHaveLength(0);
  });

  it('mostra a mensagem e o código da recusa', () => {
    const recusa = render([COM_PAGINA]).querySelector('p.field__error') as HTMLElement;

    expect(recusa.textContent).toContain(COM_PAGINA.mensagem);
    expect(recusa.querySelector('code')?.textContent).toBe(COM_PAGINA.codigo);
    expect(recusa.textContent).toContain('Código:');
  });

  it('oferece a página da recusa em nova aba, sem entregar a janela de origem', () => {
    const link = render([COM_PAGINA]).querySelector('a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe(COM_PAGINA.pagina);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('o nome do link começa pelo texto visível e avisa que abre em nova aba', () => {
    const link = render([COM_PAGINA]).querySelector('a') as HTMLAnchorElement;

    expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Entenda a recusa , abre em nova aba',
    );
    expect(link.querySelector('.sr-only')?.textContent).toBe(', abre em nova aba');
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sem página, mostra a recusa sem o link', () => {
    const host = render([SEM_PAGINA]);

    expect(host.textContent).toContain(SEM_PAGINA.mensagem);
    expect(host.querySelector('a')).toBeNull();
  });

  it('mostra cada recusa em seu parágrafo, na ordem recebida', () => {
    const paragrafos = render([COM_PAGINA, SEM_PAGINA]).querySelectorAll('p.field__error');

    expect(paragrafos).toHaveLength(2);
    expect(paragrafos[0].textContent).toContain(COM_PAGINA.codigo);
    expect(paragrafos[1].textContent).toContain(SEM_PAGINA.codigo);
  });

  it('não anuncia por conta própria: o aviso vem da região viva que contém o campo', () => {
    const host = render([COM_PAGINA]);

    expect(host.querySelector('[role="alert"], [aria-live]')).toBeNull();
  });
});
