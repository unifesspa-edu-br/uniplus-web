import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CertamePublicacoesComponent } from './certame-publicacoes';
import type { PublicacoesDoCertame } from './publicacoes.model';

const medicina: PublicacoesDoCertame = {
  documentoEditalUrl: 'https://acervo.example/editais/2026/retificacao.pdf',
  publicacoes: [
    {
      id: 'ato-2',
      data: '2026-10-20',
      titulo: 'Retificação nº YY/2026',
      tipo: 'Retificação',
      descricao: 'Corrige o cronograma.',
      documentoUrl: 'https://acervo.example/editais/2026/retificacao.pdf',
    },
    { id: 'ato-1', data: '2026-10-11', titulo: 'Edital de abertura nº XX/2026', tipo: 'Edital de abertura' },
  ],
};

describe('CertamePublicacoesComponent', () => {
  let fixture: ComponentFixture<CertamePublicacoesComponent>;

  function criar(entradas: {
    publicacoes?: PublicacoesDoCertame;
    carregando?: boolean;
    erro?: boolean;
    certameNome?: string;
  }): void {
    fixture = TestBed.createComponent(CertamePublicacoesComponent);
    fixture.componentRef.setInput('certameId', 'certame-1');
    fixture.componentRef.setInput('certameNome', entradas.certameNome ?? '');
    fixture.componentRef.setInput('publicacoes', entradas.publicacoes);
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
    });
  });

  it('nasce fechado: botão com aria-expanded=false e painel oculto, sem a linha do tempo no DOM', () => {
    criar({ publicacoes: medicina });

    expect(botao().textContent).toContain('Ver publicações');
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(painel().hidden).toBe(true);
    expect(host().querySelector('.publicacao-timeline')).toBeNull();
  });

  it('com certameNome, o botão ganha nome acessível distinto por edital (WCAG 2.4.9)', () => {
    criar({ publicacoes: medicina, certameNome: 'Medicina 2027' });

    expect(botao().textContent).toContain('Ver publicações');
    expect(botao().textContent).toContain('Medicina 2027');
  });

  it('sem certameNome, o botão não ganha sufixo (compatível com uso sem o input)', () => {
    criar({ publicacoes: medicina });

    expect(botao().textContent?.trim()).toBe('Ver publicações');
  });

  it('o botão aponta para o painel, e o painel se nomeia pelo botão', () => {
    criar({ publicacoes: medicina });

    expect(botao().getAttribute('aria-controls')).toBe(painel().id);
    expect(painel().getAttribute('aria-labelledby')).toBe(botao().id);
    expect(painel().getAttribute('role')).toBe('region');
  });

  it('abre e fecha a cada clique', () => {
    criar({ publicacoes: medicina });

    abrir();
    expect(botao().getAttribute('aria-expanded')).toBe('true');
    expect(painel().hidden).toBe(false);

    abrir();
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(painel().hidden).toBe(true);
  });

  it('aberto, mostra os atos na ordem recebida, com o motivo da retificação', () => {
    criar({ publicacoes: medicina });
    abrir();

    const titulos = Array.from(host().querySelectorAll('.publicacao-timeline__evento-titulo')).map(
      (el) => el.textContent?.trim(),
    );
    expect(titulos).toEqual(['Retificação nº YY/2026', 'Edital de abertura nº XX/2026']);
    expect(host().querySelector('.publicacao-timeline__evento-desc')?.textContent).toContain(
      'Corrige o cronograma.',
    );
  });

  it('só o primeiro ato da lista, o mais recente, é marcado como atual', () => {
    criar({ publicacoes: medicina });
    abrir();

    const atuais = Array.from(host().querySelectorAll('.publicacao-timeline__card')).map((cartao) =>
      cartao.classList.contains('is-current'),
    );
    expect(atuais).toEqual([true, false]);
    expect(host().querySelector('.publicacao-timeline__card.is-current')?.textContent).toContain(
      'Retificação nº YY/2026',
    );
  });

  it('só o ato com PDF ganha link, em nova aba e com nome acessível próprio', () => {
    criar({ publicacoes: medicina });
    abrir();

    const links = Array.from(host().querySelectorAll<HTMLAnchorElement>('.publicacao-timeline__link'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://acervo.example/editais/2026/retificacao.pdf',
    ]);
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toContain('noopener');
    expect(links[0].textContent).toContain('Retificação nº YY/2026 (abre em nova aba)');
  });

  it('a linha do tempo não oferece inscrição', () => {
    criar({ publicacoes: medicina });
    abrir();

    expect(host().textContent).not.toContain('Inscrever');
  });

  it('a linha do tempo incompleta mostra o aviso junto da lista', () => {
    criar({ publicacoes: { ...medicina, aviso: 'Pode estar incompleta.' } });
    abrir();

    expect(host().querySelector('.alert--warning')?.textContent).toContain('Pode estar incompleta.');
    expect(host().querySelectorAll('.publicacao-timeline__item')).toHaveLength(2);
  });

  it('com o aviso e sem nenhum ato, não diz que não há publicações', () => {
    criar({ publicacoes: { publicacoes: [], aviso: 'Pode estar incompleta.' } });
    abrir();

    expect(host().querySelector('.alert--warning')).not.toBeNull();
    expect(host().querySelector('.empty-state')).toBeNull();
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

  it('sem nenhum ato, mostra o estado vazio', () => {
    criar({ publicacoes: { publicacoes: [] } });
    abrir();

    expect(host().querySelector('.empty-state')?.textContent).toContain('Nenhuma publicação ainda');
  });
});
