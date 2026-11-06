import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LookupAlertComponent, UiLookupFalho } from './lookup-alert';

describe('LookupAlertComponent', () => {
  let fixture: ComponentFixture<LookupAlertComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LookupAlertComponent] });
    fixture = TestBed.createComponent(LookupAlertComponent);
  });

  function render(falhas: readonly UiLookupFalho[]): HTMLElement {
    fixture.componentRef.setInput('falhas', falhas);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('não ocupa espaço quando nenhum catálogo falhou', () => {
    const host = render([]);

    expect(host.querySelector('.alert')).toBeNull();
  });

  it('nomeia cada catálogo recusado e chama só a nova tentativa clicada', () => {
    const cursos = { nome: 'cursos', recarregar: vi.fn() };
    const locais = { nome: 'locais de oferta', recarregar: vi.fn() };
    const host = render([cursos, locais]);

    const botoes = host.querySelectorAll<HTMLButtonElement>('.lookup-alert__retry');
    expect([...botoes].map((b) => b.textContent?.trim())).toEqual([
      'Recarregar cursos',
      'Recarregar locais de oferta',
    ]);

    botoes[1].click();
    expect(locais.recarregar).toHaveBeenCalledTimes(1);
    expect(cursos.recarregar).not.toHaveBeenCalled();
  });

  /**
   * O alerta anuncia sozinho quando aparece — quem já rolou a listagem não
   * volta ao topo para descobrir que as colunas pararam de resolver.
   */
  it('é anunciado por leitor de tela ao surgir', () => {
    const host = render([{ nome: 'campi', recarregar: vi.fn() }]);
    const alerta = host.querySelector('.alert');

    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.getAttribute('aria-live')).toBe('polite');
  });

  it('concorda a frase com o número de catálogos recusados', () => {
    expect(render([{ nome: 'campi', recarregar: vi.fn() }]).textContent).toContain(
      'A coluna afetada mostra',
    );
    expect(
      render([
        { nome: 'cursos', recarregar: vi.fn() },
        { nome: 'campi', recarregar: vi.fn() },
      ]).textContent,
    ).toContain('As colunas afetadas mostram');
  });

  it('mantém o botão da nova tentativa em curso, indisponível, sem chamar de novo', () => {
    const cursos = { nome: 'cursos', pendente: true, recarregar: vi.fn() };
    const host = render([cursos, { nome: 'campi', recarregar: vi.fn() }]);
    const [emCurso, livre] = [...host.querySelectorAll<HTMLButtonElement>('.lookup-alert__retry')];

    expect(emCurso.getAttribute('aria-disabled')).toBe('true');
    expect(emCurso.getAttribute('aria-busy')).toBe('true');
    expect(livre.getAttribute('aria-disabled')).toBeNull();
    expect(livre.getAttribute('aria-busy')).toBeNull();

    emCurso.click();
    expect(cursos.recarregar).not.toHaveBeenCalled();
  });

  it('não perde o foco do botão quando a nova tentativa começa', () => {
    const host = render([{ nome: 'cursos', pendente: false, recarregar: vi.fn() }]);
    const botao = host.querySelector<HTMLButtonElement>(
      '.lookup-alert__retry',
    ) as HTMLButtonElement;
    document.body.append(host);
    botao.focus();

    render([{ nome: 'cursos', pendente: true, recarregar: vi.fn() }]);

    expect(host.querySelector('.lookup-alert__retry')).toBe(botao);
    expect(document.activeElement).toBe(botao);
    host.remove();
  });
});
