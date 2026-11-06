import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TermoConsentimentoResumoDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import { TermosConsentimentoListaComponent } from './termos-consentimento-lista.component';

const LGPD: TermoConsentimentoResumoDto = {
  id: 'id-lgpd',
  nome: 'Termo LGPD',
  formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
  revisado: true,
  criadoEm: '2026-08-13T10:00:00Z',
};
const IMAGEM: TermoConsentimentoResumoDto = {
  ...LGPD,
  id: 'id-imagem',
  nome: 'Uso de imagem',
  formaAceiteRascunho: 'OUTRA',
  revisado: false,
};

interface Estado {
  readonly itens?: readonly TermoConsentimentoResumoDto[];
  readonly loading?: boolean;
  readonly busca?: string;
  readonly filtro?: boolean;
  readonly erro?: string | null;
  readonly anterior?: unknown;
  readonly proximo?: unknown;
}

function montar(estado: Estado = {}): ComponentFixture<TermosConsentimentoListaComponent> {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(TermosConsentimentoListaComponent);
  fixture.componentRef.setInput('busca', estado.busca ?? '');
  fixture.componentRef.setInput('loading', estado.loading ?? false);
  fixture.componentRef.setInput('termosFiltrados', estado.itens ?? [LGPD, IMAGEM]);
  fixture.componentRef.setInput('prevCursor', estado.anterior ?? null);
  fixture.componentRef.setInput('nextCursor', estado.proximo ?? null);
  fixture.componentRef.setInput('temFiltroAtivo', estado.filtro ?? false);
  fixture.componentRef.setInput('errorMessage', estado.erro ?? null);
  fixture.detectChanges();
  return fixture;
}

const raiz = (fixture: ComponentFixture<unknown>): HTMLElement => fixture.nativeElement;
const acionadores = (fixture: ComponentFixture<unknown>): HTMLElement[] => [
  ...raiz(fixture).querySelectorAll<HTMLElement>('button, a'),
];
const indisponivel = (item: HTMLElement): boolean =>
  item.getAttribute('aria-disabled') === 'true' || item.matches(':disabled');

describe('TermosConsentimentoListaComponent', () => {
  it('com a lista carregando, todo acionador fica indisponível e nada é emitido', () => {
    const fixture = montar({ loading: true, anterior: 'a', proximo: 'p', erro: 'Falha' });
    const emitidos: string[] = [];
    const c = fixture.componentInstance;
    c.limpar.subscribe(() => emitidos.push('limpar'));
    c.anterior.subscribe(() => emitidos.push('anterior'));
    c.proximo.subscribe(() => emitidos.push('proximo'));
    c.buscaAlterada.subscribe(() => emitidos.push('busca'));
    const itens = acionadores(fixture);
    expect(itens.length).toBeGreaterThan(5);
    itens.forEach((item) => {
      expect(indisponivel(item), item.outerHTML).toBe(true);
      item.click();
    });
    expect(emitidos).toEqual([]);
  });

  it('limita a busca a 200 caracteres, o máximo que a API aceita', () => {
    const busca = raiz(montar()).querySelector('input[type="search"]') as HTMLInputElement;
    expect(busca.getAttribute('maxlength')).toBe('200');
  });

  it('parada, emite busca, limpeza e paginação', () => {
    const fixture = montar({ anterior: 'a', proximo: 'p', erro: 'Falha' });
    const emitidos: string[] = [];
    const c = fixture.componentInstance;
    c.limpar.subscribe(() => emitidos.push('limpar'));
    c.anterior.subscribe(() => emitidos.push('anterior'));
    c.proximo.subscribe(() => emitidos.push('proximo'));
    c.buscaAlterada.subscribe((valor) => emitidos.push(`busca:${valor}`));
    const busca = raiz(fixture).querySelector('input') as HTMLInputElement;
    busca.value = 'lgpd';
    busca.dispatchEvent(new Event('input'));
    const botao = (texto: string): HTMLElement =>
      acionadores(fixture).find((item) => item.textContent?.trim() === texto) as HTMLElement;
    ['Limpar', 'Anterior', 'Próximo'].forEach((texto) => botao(texto).click());
    expect(emitidos).toEqual(['busca:lgpd', 'limpar', 'anterior', 'proximo']);
    expect(botao('Limpar').getAttribute('aria-disabled')).toBeNull();
  });

  it('mostra forma de aceite e status de cada termo, com o token desconhecido como veio', () => {
    const linhas = [...raiz(montar()).querySelectorAll('tbody tr')];
    const celulas = (linha: Element): (string | undefined)[] =>
      ['Nome', 'Forma de aceite', 'Status de revisão'].map((rotulo) =>
        linha.querySelector(`[data-label="${rotulo}"]`)?.textContent?.trim(),
      );
    expect(celulas(linhas[0])).toEqual([
      'Termo LGPD',
      'Registro digital (com log de IP)',
      'Revisado',
    ]);
    expect(celulas(linhas[1])).toEqual(['Uso de imagem', 'OUTRA', 'Em elaboração']);
  });

  it('sem termos, oferece o cadastro; com filtro, oferece limpar a busca', () => {
    const semFiltro = montar({ itens: [] });
    expect(raiz(semFiltro).textContent).toContain('Nenhum termo de consentimento cadastrado');
    TestBed.resetTestingModule();
    const comFiltro = montar({ itens: [], filtro: true });
    expect(raiz(comFiltro).textContent).toContain('Nenhum termo encontrado');
    expect(raiz(comFiltro).textContent).toContain('Limpar filtros');
  });

  it('com falha de carga, não mostra o estado vazio', () => {
    const fixture = montar({ itens: [], erro: 'Falha ao carregar' });
    expect(raiz(fixture).querySelector('ui-empty-state')).toBeNull();
  });
});
