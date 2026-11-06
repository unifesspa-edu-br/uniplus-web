import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReferenciaReservaDemograficaDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReservaDemograficaListaComponent } from './reserva-demografica-lista.component';

const censo2022: ReferenciaReservaDemograficaDto = {
  id: 'r1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '',
};
const censo2010: ReferenciaReservaDemograficaDto = {
  ...censo2022,
  id: 'r2',
  censoReferencia: '2010',
};

describe('ReservaDemograficaListaComponent', () => {
  let fixture: ComponentFixture<ReservaDemograficaListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReservaDemograficaListaComponent] });
    fixture = TestBed.createComponent(ReservaDemograficaListaComponent);
  });

  function montar(
    referencias: readonly ReferenciaReservaDemograficaDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      referencias,
      carregando: false,
      gravando: false,
      removendo: false,
      andamento: null,
      erro: null,
      temFiltro: false,
      temAnterior: true,
      temProximo: true,
      termoBusca: '',
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const acionaveis = (): HTMLButtonElement[] =>
    botoes().filter((b) => !b.matches(':disabled') && b.getAttribute('aria-disabled') !== 'true');
  const botao = (rotulo: string): HTMLButtonElement => {
    const achado = botoes().find(
      (b) => b.getAttribute('aria-label')?.startsWith(rotulo) || b.textContent?.includes(rotulo),
    );
    expect(achado, rotulo).toBeDefined();
    return achado as HTMLButtonElement;
  };
  const botaoDoPager = (qual: string): HTMLButtonElement => {
    const achado = raiz().querySelector<HTMLButtonElement>(`ui-pager [data-pager="${qual}"]`);
    expect(achado, qual).not.toBeNull();
    return achado as HTMLButtonElement;
  };
  const aguardarFoco = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('lista o censo, os percentuais com duas casas e a base legal, com legenda e sem coluna de situação', () => {
    montar([censo2022]);
    const celulas = [...raiz().querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(celulas.slice(0, 5)).toEqual([
      '2022',
      '78.50',
      '1.20',
      '8.00',
      'Lei 12.711/2012, art. 10, III',
    ]);
    expect(raiz().querySelector('table > caption')?.classList.contains('sr-only')).toBe(true);
    expect([...raiz().querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      'Censo',
      'PPI %',
      'Quilombola %',
      'PcD %',
      'Base legal',
      'Ações',
    ]);
  });

  it('com a remoção em curso, todo botão da tela fica desabilitado, inclusive o do estado vazio e a paginação', () => {
    montar([censo2022], { removendo: true, gravando: true });
    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    montar([], { removendo: true, gravando: true });
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-empty-state button')?.matches(':disabled')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('durante a carga, deixa as ações indisponíveis e mostra o andamento', () => {
    montar([censo2022], { carregando: true });
    expect(acionaveis()).toEqual([]);
    expect(raiz().textContent).toContain('Carregando');
    expect(raiz().querySelector('.list-state__loading')).not.toBeNull();
  });

  it('emite cadastro, edição e remoção com a referência da linha', () => {
    montar([censo2022]);
    const emitidos: string[] = [];
    const lista = fixture.componentInstance;
    lista.cadastrar.subscribe(() => emitidos.push('cadastrar'));
    lista.editar.subscribe((r) => emitidos.push(`editar:${r.id}`));
    lista.remover.subscribe((r) => emitidos.push(`remover:${r.id}`));
    botao('Novo censo').click();
    botao('Editar reserva demográfica do censo 2022').click();
    botao('Remover reserva demográfica do censo 2022').click();
    expect(emitidos).toEqual(['cadastrar', 'editar:r1', 'remover:r1']);
  });

  it('mostra o andamento só na linha afetada, fora da árvore de acessibilidade', () => {
    montar([censo2022, censo2010], { andamento: { id: 'r2', rotulo: 'Salvando...' } });
    const andamentos = raiz().querySelectorAll('td span[aria-hidden="true"]');
    expect(andamentos).toHaveLength(1);
    expect(andamentos[0].closest('tr')).toBe(raiz().querySelectorAll('tbody tr')[1]);
  });

  it('com erro de carga, não mostra o estado vazio', () => {
    montar([], { erro: 'Falha' });
    expect(raiz().querySelector('ui-empty-state')).toBeNull();
  });

  it('distingue a lista vazia da busca sem resultado e limpa o termo', () => {
    montar([]);
    expect(raiz().textContent).toContain('Nenhuma referência cadastrada');
    montar([], { termoBusca: 'xyz', temFiltro: true });
    expect(raiz().textContent).toContain('Nenhuma referência encontrada');
    botao('Limpar filtros').click();
    expect(fixture.componentInstance.termoBusca()).toBe('');
    fixture.componentRef.setInput('termoBusca', 'abc');
    fixture.detectChanges();
    expect(fixture.componentInstance.termoBusca()).toBe('abc');
    botoes()
      .find((b) => b.textContent?.trim() === 'Limpar')
      ?.click();
    expect(fixture.componentInstance.termoBusca()).toBe('');
  });

  it('o estado vazio oferece o cadastro e o emite', () => {
    montar([]);
    let emitiu = false;
    fixture.componentInstance.cadastrar.subscribe(() => (emitiu = true));
    raiz().querySelector<HTMLButtonElement>('ui-empty-state button')?.click();
    expect(emitiu).toBe(true);
  });

  it('emite a mudança de página', () => {
    montar([censo2022]);
    const emitidos: string[] = [];
    fixture.componentInstance.anterior.subscribe(() => emitidos.push('anterior'));
    fixture.componentInstance.proximo.subscribe(() => emitidos.push('proximo'));
    for (const botaoDePagina of ['prev', 'next']) {
      botaoDoPager(botaoDePagina).click();
    }
    expect(emitidos).toEqual(['anterior', 'proximo']);
  });

  const gravar = (): void => {
    fixture.componentRef.setInput('gravando', true);
    fixture.detectChanges();
  };
  const terminarGravacao = async (): Promise<void> => {
    fixture.componentRef.setInput('gravando', false);
    fixture.detectChanges();
    await aguardarFoco();
  };
  const acaoDaLinha = (id: string, verbo: 'Editar' | 'Remover'): HTMLButtonElement =>
    raiz().querySelector(
      `tr[data-referencia-id="${id}"] button[aria-label^="${verbo} reserva"]`,
    ) as HTMLButtonElement;

  it('terminada a gravação, devolve o foco à ação acionada na linha, não a outra da mesma linha', async () => {
    montar([censo2022, censo2010]);
    acaoDaLinha('r2', 'Remover').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('r2', 'Remover'));
  });

  it('devolve o foco ao botão do cabeçalho quando o cadastro originou a gravação', async () => {
    montar([censo2022]);
    botao('Novo censo').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(botao('Novo censo'));
  });

  it('sem a linha acionada, leva o foco ao título da lista', async () => {
    montar([censo2022]);
    acaoDaLinha('r1', 'Remover').click();
    gravar();
    fixture.componentRef.setInput('referencias', []);
    await terminarGravacao();
    expect(document.activeElement).toBe(raiz().querySelector('#cfg-reserva-list-title'));
  });

  it('não tira o foco de quem o levou a outro ponto durante a gravação', async () => {
    montar([censo2022]);
    acaoDaLinha('r1', 'Editar').click();
    gravar();
    const outro = document.createElement('button');
    document.body.append(outro);
    outro.focus();
    await terminarGravacao();
    expect(document.activeElement).toBe(outro);
    outro.remove();
  });
});
