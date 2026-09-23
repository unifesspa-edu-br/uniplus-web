import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PublicacoesListaComponent } from './publicacoes-lista';
import type { Publicacao } from './publicacoes.model';
import { PublicacoesRepository } from './publicacoes.repository';

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((consulta: string) =>
    ({
      matches,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const medicina: Publicacao = {
  id: 'medicina-2027',
  numeroEdital: '012/2026',
  titulo: 'Medicina 2027',
  descricao: 'Lista de classificação final por curso, campus e modalidade de concorrência.',
  situacao: 'resultadoDivulgado',
  dataPublicacao: '2026-04-16',
  historico: [],
};

const ppgcf: Publicacao = {
  id: 'ppgcf-2026',
  numeroEdital: '009/2026',
  titulo: 'PPGCF',
  descricao: 'Resultado preliminar, sujeito a recurso até 20 de abril.',
  situacao: 'resultadoPreliminar',
  dataPublicacao: '2026-04-02',
  historico: [],
};

const tecnicoEnfermagem: Publicacao = {
  id: 'tecnico-enfermagem-2026',
  numeroEdital: '007/2026',
  titulo: 'Técnico em Enfermagem',
  descricao: 'Inscrições abertas para vagas em Marabá e Altamira.',
  situacao: 'inscricoesAbertas',
  dataPublicacao: '2026-03-01',
  historico: [],
};

const FIXTURES: readonly Publicacao[] = [medicina, ppgcf, tecnicoEnfermagem];

describe('PublicacoesListaComponent', () => {
  let fixture: ComponentFixture<PublicacoesListaComponent>;
  let component: PublicacoesListaComponent;
  const matchMediaOriginal = window.matchMedia;

  function criarComponente(listarNaoFinalizadas: () => Observable<readonly Publicacao[]>): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PublicacoesListaComponent],
      providers: [
        provideRouter([]),
        { provide: PublicacoesRepository, useValue: { listarNaoFinalizadas } },
      ],
    });

    fixture = TestBed.createComponent(PublicacoesListaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    stubMatchMedia(false);
    criarComponente(() => of(FIXTURES));
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function chip(rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(host().querySelectorAll<HTMLButtonElement>('.filter-chip')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  function botao(rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  it('carrega e mostra as publicações devolvidas pelo repositório', () => {
    expect(component['publicacoes']().map((publicacao) => publicacao.titulo)).toEqual([
      'Medicina 2027',
      'PPGCF',
      'Técnico em Enfermagem',
    ]);
  });

  it('anuncia a contagem numa região viva', () => {
    const status = host().querySelector('.publicacoes-count[role="status"]');
    expect(status?.textContent).toContain(`${component['publicacoes']().length}`);
  });

  it('busca por título filtra a lista', () => {
    component['termoBusca'].set('medicina');
    fixture.detectChanges();

    const titulos = component['publicacoes']().map((publicacao) => publicacao.titulo);
    expect(titulos).toEqual(['Medicina 2027']);
  });

  it('busca ignora acento e caixa (CA-04)', () => {
    component['termoBusca'].set('TECNICO');
    fixture.detectChanges();

    expect(component['publicacoes']().map((publicacao) => publicacao.titulo)).toEqual([
      'Técnico em Enfermagem',
    ]);
  });

  it('o título de cada publicação é h2, logo abaixo do h1 da página', () => {
    const titulos = Array.from(host().querySelectorAll('.edital-row__title'));
    expect(titulos.length).toBeGreaterThan(0);
    expect(titulos.every((titulo) => titulo.tagName === 'H2')).toBe(true);
  });

  it('busca por número de edital filtra a lista', () => {
    component['termoBusca'].set('009/2026');
    fixture.detectChanges();

    expect(component['publicacoes']().map((publicacao) => publicacao.titulo)).toEqual(['PPGCF']);
  });

  it('filtro por situação restringe a lista e "Limpar filtros" desfaz tudo', () => {
    chip('Resultado divulgado')?.click();
    fixture.detectChanges();

    expect(
      component['publicacoes']().every(
        (publicacao) => publicacao.situacao === 'resultadoDivulgado',
      ),
    ).toBe(true);
    expect(component['temFiltrosAtivos']()).toBe(true);

    botao('Limpar filtros')?.click();
    fixture.detectChanges();

    expect(component['temFiltrosAtivos']()).toBe(false);
  });

  it('contadores dos chips refletem os dados carregados', () => {
    expect(chip('Resultado divulgado')?.textContent).toContain('1');
    expect(chip('Resultado preliminar')?.textContent).toContain('1');
    expect(chip('Inscrições abertas')?.textContent).toContain('1');
    expect(chip('Em homologação')?.textContent).toContain('0');
  });

  it('alternar entre lista e cards não descarta a busca nem os filtros', () => {
    component['termoBusca'].set('medicina');
    chip('Resultado divulgado')?.click();
    fixture.detectChanges();

    component['setVisao']('cards');
    fixture.detectChanges();

    expect(component['termoBusca']()).toBe('medicina');
    expect(component['situacaoSelecionada']()).toBe('resultadoDivulgado');
    expect(host().querySelector('.publicacoes-grid')).toBeTruthy();
    expect(component['publicacoes']().map((publicacao) => publicacao.titulo)).toEqual([
      'Medicina 2027',
    ]);
  });

  it('"Ver detalhes" aponta para /publicacoes/:id', () => {
    const link = host().querySelector<HTMLAnchorElement>('a.btn--primary');
    expect(link?.getAttribute('href')).toMatch(/^\/publicacoes\/.+/);
  });

  it('estado vazio: busca sem resultado orienta a limpar os filtros', () => {
    component['termoBusca'].set('curso que não existe');
    fixture.detectChanges();

    const vazio = host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhuma publicação encontrada');
  });

  it('estado vazio: repositório sem publicações mostra aviso sem sugerir filtro', () => {
    criarComponente(() => of([]));

    const vazio = host().querySelector('.empty-state');
    expect(vazio?.textContent).toContain('Nenhuma publicação em andamento no momento');
  });

  it('mostra o estado de carregando antes dos dados chegarem', async () => {
    criarComponente(() => of(FIXTURES).pipe(delay(30)));

    expect(component['carregando']()).toBe(true);
    expect(host().querySelector('.publicacoes-loading[role="status"]')).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 60));
    fixture.detectChanges();

    expect(component['carregando']()).toBe(false);
    expect(component['publicacoes']().length).toBe(FIXTURES.length);
  });

  it('estado de erro mostra mensagem e ação de tentar novamente', () => {
    criarComponente(() => throwError(() => new Error('falha de rede')));

    expect(component['erro']()).toBe('Não foi possível carregar as publicações.');
    expect(component['carregando']()).toBe(false);
    expect(host().querySelector('.alert--danger')).toBeTruthy();
    expect(botao('Tentar novamente')).toBeTruthy();
  });

  it('"Tentar novamente" reexecuta a busca após uma falha', () => {
    let tentativas = 0;
    criarComponente(() => {
      tentativas += 1;
      return tentativas === 1 ? throwError(() => new Error('falha de rede')) : of(FIXTURES);
    });
    expect(component['erro']()).not.toBeNull();

    botao('Tentar novamente')?.click();
    fixture.detectChanges();

    expect(component['erro']()).toBeNull();
    expect(component['publicacoes']().length).toBe(FIXTURES.length);
  });

  it('lembra a visão escolhida entre visitas (localStorage)', () => {
    component['setVisao']('cards');
    fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.publicacoes-visao')).toBe('cards');
  });

  it('abaixo de 600px o controle de alternância some e a lista é canônica', () => {
    stubMatchMedia(true);
    criarComponente(() => of(FIXTURES));

    component['visao'].set('cards');
    fixture.detectChanges();

    expect(component['visaoEfetiva']()).toBe('lista');
    expect(host().querySelector('ui-segmented')).toBeNull();
    expect(host().querySelector('.publicacoes-list')).toBeTruthy();
    expect(host().querySelector('.publicacoes-grid')).toBeNull();
  });
});
