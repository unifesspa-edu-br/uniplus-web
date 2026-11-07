import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { CatalogoAcompanhado } from '../alerta-nova-tentativa/leitura-acompanhada';
import type { FaseDaNovaTentativa } from '../alerta-nova-tentativa/nova-tentativa';
import { LookupAlertComponent } from './lookup-alert';

function leitura(
  assunto: string,
  opcoes: { visivel?: boolean; fase?: FaseDaNovaTentativa; pendente?: boolean } = {},
): CatalogoAcompanhado & { tentar: Mock<() => void> } {
  return {
    assunto,
    visivel: signal(opcoes.visivel ?? true),
    mensagem: signal(''),
    fase: signal(opcoes.fase ?? 'inicial'),
    pendente: signal(opcoes.pendente ?? false),
    indisponivel: signal(false),
    tentar: vi.fn<() => void>(),
  };
}

describe('LookupAlertComponent', () => {
  let fixture: ComponentFixture<LookupAlertComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LookupAlertComponent] });
    fixture = TestBed.createComponent(LookupAlertComponent);
  });

  function render(leituras: readonly CatalogoAcompanhado[]): HTMLElement {
    fixture.componentRef.setInput('leituras', leituras);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('não ocupa espaço quando nenhum catálogo falhou', () => {
    const host = render([leitura('cursos', { visivel: false })]);

    expect(host.querySelector('.alert')).toBeNull();
  });

  it('nomeia cada catálogo em falha e dispara só a nova tentativa clicada', () => {
    const cursos = leitura('cursos');
    const locais = leitura('locais de oferta');
    const campi = leitura('campi', { visivel: false });
    const host = render([cursos, locais, campi]);

    const botoes = host.querySelectorAll<HTMLButtonElement>('.link-button');
    expect([...botoes].map((b) => b.textContent?.trim())).toEqual([
      'Recarregar cursos',
      'Recarregar locais de oferta',
    ]);

    botoes[1].click();
    expect(locais.tentar).toHaveBeenCalledTimes(1);
    expect(cursos.tentar).not.toHaveBeenCalled();
  });

  it('mantém o botão do catálogo ao receber outra leitura do mesmo assunto, e a nova tentativa vai à leitura atual', () => {
    const antes = leitura('campi');
    const host = render([antes]);
    const botao = host.querySelector<HTMLButtonElement>('.link-button');

    const depois = leitura('campi');
    const hostDepois = render([depois]);
    hostDepois.querySelector<HTMLButtonElement>('.link-button')?.click();

    expect(hostDepois.querySelector('.link-button')).toBe(botao);
    expect(depois.tentar).toHaveBeenCalledTimes(1);
    expect(antes.tentar).not.toHaveBeenCalled();
  });

  /**
   * O alerta anuncia sozinho quando aparece — quem já rolou a listagem não
   * volta ao topo para descobrir que as colunas pararam de resolver.
   */
  it('é anunciado por leitor de tela ao surgir', () => {
    const alerta = render([leitura('campi')]).querySelector('.alert [role="alert"]');

    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.getAttribute('aria-live')).toBe('polite');
  });

  it('concorda a frase com o número de catálogos em falha', () => {
    expect(render([leitura('campi')]).textContent).toContain('A coluna afetada mostra');
    expect(render([leitura('cursos'), leitura('campi')]).textContent).toContain(
      'As colunas afetadas mostram',
    );
  });

  it('mostra a fase da nova tentativa do catálogo e o ocupado só enquanto ela corre', () => {
    const host = render([
      leitura('campi', { fase: 'tentando', pendente: true }),
      leitura('cursos'),
    ]);
    const [emCurso, livre] = [...host.querySelectorAll<HTMLButtonElement>('.link-button')];

    expect(host.querySelector('[role="status"]')?.textContent).toBe('Recarregando campi…');
    expect(emCurso.getAttribute('aria-busy')).toBe('true');
    expect(livre.getAttribute('aria-busy')).toBeNull();
  });
});
