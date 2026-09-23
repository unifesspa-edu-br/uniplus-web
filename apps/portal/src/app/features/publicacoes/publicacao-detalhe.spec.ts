import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { beforeEach, describe, expect, it } from 'vitest';

import { PublicacaoDetalheComponent } from './publicacao-detalhe';
import type { Publicacao } from './publicacoes.model';
import { PublicacoesRepository } from './publicacoes.repository';

const medicina: Publicacao = {
  id: 'medicina-2027',
  numeroEdital: '012/2026',
  titulo: 'Medicina 2027',
  descricao: 'Lista de classificação final por curso, campus e modalidade de concorrência.',
  situacao: 'resultadoDivulgado',
  dataPublicacao: '2026-04-16',
  historico: [
    {
      id: 'evt-1',
      categoria: 'edital',
      data: '2026-01-05',
      titulo: 'Edital publicado',
      documentoArquivo: 'documento.pdf',
    },
    { id: 'evt-2', categoria: 'inscricoes', data: '2026-01-20', titulo: 'Inscrições abertas' },
    { id: 'evt-3', categoria: 'inscricoes', data: '2026-03-10', titulo: 'Inscrições encerradas' },
    {
      id: 'evt-4',
      categoria: 'resultadoPreliminar',
      data: '2026-04-01',
      titulo: 'Resultado preliminar divulgado',
      descricao: 'Sujeito a recurso até 08 de abril.',
      documentoArquivo: 'documento.pdf',
    },
    {
      id: 'evt-5',
      categoria: 'resultado',
      data: '2026-04-16',
      titulo: 'Resultado final divulgado',
      documentoArquivo: 'documento.pdf',
    },
  ],
};

describe('PublicacaoDetalheComponent', () => {
  let fixture: ComponentFixture<PublicacaoDetalheComponent>;
  let component: PublicacaoDetalheComponent;

  function criarComponente(
    buscarPorId: (id: string) => Observable<Publicacao | undefined>,
    id = 'medicina-2027',
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PublicacaoDetalheComponent],
      providers: [provideRouter([]), { provide: PublicacoesRepository, useValue: { buscarPorId } }],
    });

    fixture = TestBed.createComponent(PublicacaoDetalheComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  beforeEach(() => {
    criarComponente(() => of(medicina));
  });

  it('mostra o título, a situação e o cabeçalho da publicação (CA-02)', () => {
    const h1 = host().querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Medicina 2027');
    expect(host().querySelector('.tag')?.textContent).toContain('Resultado divulgado');
    expect(host().textContent).toContain('012/2026');
    expect(host().textContent).toContain(medicina.descricao);
  });

  it('a linha do tempo mostra os eventos do mais recente para o mais antigo (CA-04/CA-05)', () => {
    const eventos = host().querySelectorAll('.publicacao-timeline__item');
    expect(eventos.length).toBe(5);
    expect(eventos[0].textContent).toContain('Resultado final divulgado');
    expect(eventos[eventos.length - 1].textContent).toContain('Edital publicado');
  });

  it('a linha do tempo é uma seção nomeada pelo h2 que a encabeça (CA-14)', () => {
    const secao = host().querySelector('section.publicacao-historico');
    const idDoTitulo = secao?.getAttribute('aria-labelledby') ?? '';
    const titulo = host().querySelector(`#${idDoTitulo}`);

    expect(titulo?.tagName).toBe('H2');
    expect(titulo?.textContent?.trim()).toBe('Linha do tempo');
  });

  it('cada cartão mostra a categoria do evento e só o mais recente fica em destaque', () => {
    const cartoes = host().querySelectorAll('.publicacao-timeline__card');
    expect(cartoes[0].querySelector('.tag')?.textContent).toContain('Resultado');
    expect(cartoes[cartoes.length - 1].querySelector('.tag')?.textContent).toContain('Edital');

    expect(host().querySelectorAll('.publicacao-timeline__card.is-current')).toHaveLength(1);
    expect(cartoes[0].classList.contains('is-current')).toBe(true);
  });

  it('só os eventos com documento disponível viram link, cada um com endereço próprio (CA-06/CA-07)', () => {
    const links = host().querySelectorAll<HTMLAnchorElement>('.publicacao-timeline__link');
    expect(links.length).toBe(3);
    links.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
      expect(link.getAttribute('href')).toMatch(
        /^\/publicacoes\/medicina-2027\/eventos\/evt-\d\/documento$/,
      );
    });
    const hrefs = Array.from(links).map((link) => link.getAttribute('href'));
    expect(new Set(hrefs).size).toBe(links.length);

    // "Inscrições abertas" e "Inscrições encerradas" não têm documento — não viram link.
    const eventos = Array.from(host().querySelectorAll('.publicacao-timeline__item'));
    const semDocumento = eventos.filter((item) => item.textContent?.includes('Inscrições'));
    expect(semDocumento).toHaveLength(2);
    semDocumento.forEach((item) =>
      expect(item.querySelector('.publicacao-timeline__link')).toBeNull(),
    );
  });

  it('link do documento anuncia "abre em nova aba" para tecnologia assistiva (CA-14)', () => {
    const link = host().querySelector('.publicacao-timeline__link');
    expect(link?.querySelector('.sr-only')?.textContent).toContain('abre em nova aba');
  });

  it('voltar para publicações direciona para a listagem (CA-03)', () => {
    const link = host().querySelector<HTMLAnchorElement>('a.publicacao-voltar');
    expect(link?.getAttribute('href')).toBe('/publicacoes');
  });

  it('mostra o estado de carregando antes dos dados chegarem', () => {
    criarComponente(() => of(medicina).pipe(delay(30)));

    expect(component['carregando']()).toBe(true);
    expect(host().querySelector('.publicacao-loading[role="status"]')).toBeTruthy();
    expect(host().querySelector('h1')).toBeNull();
  });

  it('id desconhecido mostra estado de "não encontrado" com um caminho de volta (CA-09)', () => {
    criarComponente(() => of(undefined), 'edital-que-nao-existe');

    const vazio = host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Publicação não encontrada');
    expect(host().querySelector('h1')).toBeNull();
    expect(host().querySelector('a[routerLink="/publicacoes"]')).toBeTruthy();
  });

  it('publicação sem eventos mostra estado vazio na linha do tempo (CA-10)', () => {
    criarComponente(() => of({ ...medicina, historico: [] }));

    expect(host().querySelector('h1')?.textContent?.trim()).toBe('Medicina 2027');
    expect(host().querySelector('.publicacao-timeline')).toBeNull();
    expect(host().querySelector('.empty-state')?.textContent).toContain('Nenhum evento registrado');
  });

  it('estado de erro mostra mensagem e ação de tentar novamente (CA-12)', () => {
    criarComponente(() => throwError(() => new Error('falha de rede')));

    expect(component['erro']()).toBe('Não foi possível carregar esta publicação.');
    expect(host().querySelector('.alert--danger')).toBeTruthy();
    expect(botao('Tentar novamente')).toBeTruthy();
  });

  it('"Tentar novamente" reexecuta a busca após uma falha', () => {
    let tentativas = 0;
    criarComponente(() => {
      tentativas += 1;
      return tentativas === 1 ? throwError(() => new Error('falha de rede')) : of(medicina);
    });
    expect(component['erro']()).not.toBeNull();

    botao('Tentar novamente')?.click();
    fixture.detectChanges();

    expect(component['erro']()).toBeNull();
    expect(host().querySelector('h1')?.textContent?.trim()).toBe('Medicina 2027');
  });
});
