import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { CertamePublicacoesComponent } from './certame-publicacoes';
import type { Publicacao } from './publicacoes.model';

const medicina: Publicacao = {
  id: 'medicina-2027',
  numeroEdital: '012/2026',
  titulo: 'Medicina 2027',
  descricao: 'Lista de classificação final.',
  situacao: 'resultadoDivulgado',
  dataPublicacao: '2026-04-16',
  historico: [
    {
      id: 'evt-1',
      categoria: 'edital',
      data: '2026-01-05',
      titulo: 'Edital publicado',
      documentoArquivo: 'edital-012-2026.pdf',
    },
    {
      id: 'evt-2',
      categoria: 'inscricoes',
      data: '2026-01-20',
      titulo: 'Inscrições abertas',
      descricao: 'Período de inscrições até 10 de março.',
    },
    {
      id: 'evt-3',
      categoria: 'resultado',
      data: '2026-04-16',
      titulo: 'Resultado final divulgado',
      documentoArquivo: 'resultado-final.pdf',
    },
  ],
};

describe('CertamePublicacoesComponent', () => {
  let fixture: ComponentFixture<CertamePublicacoesComponent>;

  function criar(entradas: {
    publicacao?: Publicacao;
    carregando?: boolean;
    erro?: boolean;
  }): void {
    fixture = TestBed.createComponent(CertamePublicacoesComponent);
    fixture.componentRef.setInput('certameId', 'certame-1');
    fixture.componentRef.setInput('publicacao', entradas.publicacao);
    fixture.componentRef.setInput('carregando', entradas.carregando ?? false);
    fixture.componentRef.setInput('erro', entradas.erro ?? false);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(): HTMLButtonElement {
    return host().querySelector<HTMLButtonElement>('.publicacoes-toggle') as HTMLButtonElement;
  }

  function painel(): HTMLElement {
    return host().querySelector<HTMLElement>('.publicacoes-painel') as HTMLElement;
  }

  function abrir(): void {
    botao().click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CertamePublicacoesComponent],
      providers: [provideRouter([])],
    });
  });

  it('nasce fechado: botão com aria-expanded=false e painel oculto, sem a linha do tempo no DOM', () => {
    criar({ publicacao: medicina });

    expect(botao().textContent).toContain('Ver publicações');
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(painel().hidden).toBe(true);
    expect(host().querySelector('.publicacao-timeline')).toBeNull();
  });

  it('o botão aponta para o painel, e o painel se nomeia pelo botão', () => {
    criar({ publicacao: medicina });

    expect(botao().getAttribute('aria-controls')).toBe(painel().id);
    expect(painel().getAttribute('aria-labelledby')).toBe(botao().id);
    expect(painel().getAttribute('role')).toBe('region');
  });

  it('abre e fecha a cada clique', () => {
    criar({ publicacao: medicina });

    abrir();
    expect(botao().getAttribute('aria-expanded')).toBe('true');
    expect(painel().hidden).toBe(false);

    abrir();
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(painel().hidden).toBe(true);
  });

  it('aberto, mostra a linha do tempo com o evento mais recente no topo e marcado como atual', () => {
    criar({ publicacao: medicina });
    abrir();

    const titulos = Array.from(host().querySelectorAll('.publicacao-timeline__evento-titulo')).map(
      (el) => el.textContent?.trim(),
    );
    expect(titulos).toEqual(['Resultado final divulgado', 'Inscrições abertas', 'Edital publicado']);
    const cartoes = host().querySelectorAll('.publicacao-timeline__card');
    expect(cartoes[0].classList.contains('is-current')).toBe(true);
    expect(cartoes[1].classList.contains('is-current')).toBe(false);
  });

  it('só eventos com PDF ganham link, apontando para o documento do evento, em nova aba', () => {
    criar({ publicacao: medicina });
    abrir();

    const links = Array.from(host().querySelectorAll<HTMLAnchorElement>('.publicacao-timeline__link'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/publicacoes/medicina-2027/eventos/evt-3/documento',
      '/publicacoes/medicina-2027/eventos/evt-1/documento',
    ]);
    expect(links.every((a) => a.target === '_blank' && a.rel.includes('noopener'))).toBe(true);
    expect(links[0].textContent).toContain('abre em nova aba');
  });

  it('enquanto as publicações carregam, avisa numa região viva', () => {
    criar({ carregando: true });
    abrir();

    expect(host().querySelector('[role="status"]')?.textContent).toContain('Carregando publicações');
    expect(host().querySelector('.publicacao-timeline')).toBeNull();
  });

  it('falha na consulta mostra o alerta, não uma linha do tempo vazia', () => {
    criar({ erro: true });
    abrir();

    expect(host().querySelector('.alert--danger')?.textContent).toContain(
      'Não foi possível carregar as publicações',
    );
  });

  it('edital sem publicações registradas mostra estado vazio', () => {
    criar({});
    abrir();

    expect(host().querySelector('.empty-state')?.textContent).toContain('Nenhuma publicação ainda');
  });

  it('publicação sem eventos mostra estado vazio da linha do tempo', () => {
    criar({ publicacao: { ...medicina, historico: [] } });
    abrir();

    expect(host().querySelector('.empty-state')?.textContent).toContain('Nenhum evento registrado');
  });
});
