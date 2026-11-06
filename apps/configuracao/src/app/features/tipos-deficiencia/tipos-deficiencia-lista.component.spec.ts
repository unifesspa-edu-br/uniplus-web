import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { TiposDeficienciaListaComponent } from './tipos-deficiencia-lista.component';

const visual: TipoDeficienciaDto = {
  id: 'r1',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: null,
  criadoEm: '',
};
const auditiva: TipoDeficienciaDto = { ...visual, id: 'r2', codigo: 'AUDITIVA', nome: 'Auditiva' };

describe('TiposDeficienciaListaComponent', () => {
  let fixture: ComponentFixture<TiposDeficienciaListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TiposDeficienciaListaComponent] });
    fixture = TestBed.createComponent(TiposDeficienciaListaComponent);
  });

  function montar(
    tipos: readonly TipoDeficienciaDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      tipos,
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

  it('lista código, nome e descrição, com legenda e sem coluna de situação', () => {
    montar([visual]);
    expect(raiz().textContent).toContain('Baixa visão');
    expect(raiz().querySelector('table > caption')?.classList.contains('sr-only')).toBe(true);
    const cabecalhos = [...raiz().querySelectorAll('thead th')];
    expect(cabecalhos.map((th) => th.textContent?.trim())).toEqual([
      'Código',
      'Nome',
      'Descrição',
      'Ações',
    ]);
  });

  it('com a remoção em curso, todo botão da tela fica desabilitado, inclusive o do estado vazio e a paginação', () => {
    montar([visual], { removendo: true, gravando: true });
    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    montar([], { removendo: true, gravando: true });
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-empty-state button')?.matches(':disabled')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('durante a carga, deixa as ações indisponíveis e mostra o andamento', () => {
    montar([visual], { carregando: true });
    expect(acionaveis()).toEqual([]);
    expect(raiz().textContent).toContain('Carregando');
  });

  it('emite cadastro, edição e remoção quando disponível', () => {
    montar([visual]);
    const emitidos: string[] = [];
    const lista = fixture.componentInstance;
    lista.cadastrar.subscribe(() => emitidos.push('cadastrar'));
    lista.editar.subscribe((r) => emitidos.push(`editar:${r.id}`));
    lista.remover.subscribe((r) => emitidos.push(`remover:${r.id}`));
    botao('Novo tipo').click();
    botao('Editar').click();
    botao('Remover').click();
    expect(emitidos).toEqual(['cadastrar', 'editar:r1', 'remover:r1']);
  });

  it('mostra o andamento só na linha afetada, fora da árvore de acessibilidade', () => {
    montar([visual, auditiva], { andamento: { id: 'r2', rotulo: 'Salvando...' } });
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
    expect(raiz().textContent).toContain('Nenhum tipo de deficiência carregado');
    montar([], { termoBusca: 'xyz', temFiltro: true });
    expect(raiz().textContent).toContain('Nenhum tipo de deficiência encontrado');
    botao('Limpar filtros').click();
    expect(fixture.componentInstance.termoBusca()).toBe('');
    fixture.componentRef.setInput('termoBusca', 'xyz');
    fixture.detectChanges();
    botao('Limpar').click();
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
    montar([visual]);
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
      `tr[data-tipo-id="${id}"] button[aria-label^="${verbo} tipo"]`,
    ) as HTMLButtonElement;

  it('terminada a gravação, devolve o foco ao botão da linha acionada', async () => {
    montar([visual, auditiva]);
    acaoDaLinha('r2', 'Editar').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('r2', 'Editar'));
  });

  it('devolve o foco à ação acionada, não a outra da mesma linha', async () => {
    montar([visual]);
    acaoDaLinha('r1', 'Remover').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('r1', 'Remover'));
  });

  it('devolve o foco ao botão do cabeçalho quando o cadastro originou a gravação', async () => {
    montar([visual]);
    botao('Novo tipo').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(botao('Novo tipo'));
  });

  it('sem a linha acionada, leva o foco ao título da lista', async () => {
    montar([visual]);
    acaoDaLinha('r1', 'Remover').click();
    gravar();
    fixture.componentRef.setInput('tipos', []);
    await terminarGravacao();
    expect(document.activeElement).toBe(raiz().querySelector('#cfg-tipos-deficiencia-list-title'));
  });

  it('não tira o foco de quem o levou a outro ponto durante a gravação', async () => {
    montar([visual]);
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
