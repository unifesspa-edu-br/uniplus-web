import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { CondicoesAtendimentoListaComponent } from './condicoes-atendimento-lista.component';

const ledor: CondicaoAtendimentoDto = {
  id: 'c1',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: 'Leitura de provas',
  criadoEm: '',
};
const pcd: CondicaoAtendimentoDto = { ...ledor, id: 'c2', codigo: 'PCD', nome: 'Pcd' };

describe('CondicoesAtendimentoListaComponent', () => {
  let fixture: ComponentFixture<CondicoesAtendimentoListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CondicoesAtendimentoListaComponent] });
    fixture = TestBed.createComponent(CondicoesAtendimentoListaComponent);
  });

  function montar(
    condicoes: readonly CondicaoAtendimentoDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      condicoes,
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

  it('com a remoção em curso, todo botão da tela fica desabilitado, inclusive o do estado vazio e a paginação', () => {
    montar([ledor], { removendo: true, gravando: true });
    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    montar([], { removendo: true, gravando: true });
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-empty-state button')?.matches(':disabled')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('durante a carga, deixa as ações indisponíveis e mostra o andamento', () => {
    montar([ledor], { carregando: true });
    expect(acionaveis()).toEqual([]);
    expect(raiz().textContent).toContain('Carregando');
  });

  it('emite cadastro, edição e remoção quando disponível', () => {
    montar([ledor]);
    const emitidos: string[] = [];
    const lista = fixture.componentInstance;
    lista.cadastrar.subscribe(() => emitidos.push('cadastrar'));
    lista.editar.subscribe((c) => emitidos.push(`editar:${c.id}`));
    lista.remover.subscribe((c) => emitidos.push(`remover:${c.id}`));
    botao('Nova condição').click();
    botao('Editar').click();
    botao('Remover').click();
    expect(emitidos).toEqual(['cadastrar', 'editar:c1', 'remover:c1']);
  });

  it('a condição PCD não pode ser removida e explica o motivo', () => {
    montar([pcd]);
    const remover = botao('Remover');
    expect(remover.matches(':disabled')).toBe(true);
    expect(raiz().textContent).toContain('A condição PCD não pode ser removida.');
    expect(botao('Editar').matches(':disabled')).toBe(false);
  });

  it('mostra o andamento só na linha afetada, fora da árvore de acessibilidade', () => {
    montar([ledor, pcd], { andamento: { id: 'c2', rotulo: 'Salvando...' } });
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
    expect(raiz().textContent).toContain('Nenhuma condição de atendimento carregada');
    montar([], { termoBusca: 'xyz', temFiltro: true });
    expect(raiz().textContent).toContain('Nenhuma condição de atendimento encontrada');
    botao('Limpar filtros').click();
    expect(fixture.componentInstance.termoBusca()).toBe('');
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
    montar([ledor]);
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
      `tr[data-condicao-id="${id}"] button[aria-label^="${verbo} condição"]`,
    ) as HTMLButtonElement;

  it('terminada a gravação, devolve o foco ao botão da linha acionada', async () => {
    montar([ledor, pcd]);
    acaoDaLinha('c2', 'Editar').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('c2', 'Editar'));
  });

  it('devolve o foco à ação acionada, não a outra da mesma linha', async () => {
    montar([ledor]);
    acaoDaLinha('c1', 'Remover').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(acaoDaLinha('c1', 'Remover'));
  });

  it('devolve o foco ao botão do cabeçalho quando o cadastro originou a gravação', async () => {
    montar([ledor]);
    botao('Nova condição').click();
    gravar();
    await terminarGravacao();
    expect(document.activeElement).toBe(botao('Nova condição'));
  });

  it('sem a linha acionada, leva o foco ao título da lista', async () => {
    montar([ledor]);
    acaoDaLinha('c1', 'Remover').click();
    gravar();
    fixture.componentRef.setInput('condicoes', []);
    await terminarGravacao();
    expect(document.activeElement).toBe(
      raiz().querySelector('#cfg-condicoes-atendimento-list-title'),
    );
  });

  it('não tira o foco de quem o levou a outro ponto durante a gravação', async () => {
    montar([ledor]);
    acaoDaLinha('c1', 'Editar').click();
    gravar();
    const outro = document.createElement('button');
    document.body.append(outro);
    outro.focus();
    await terminarGravacao();
    expect(document.activeElement).toBe(outro);
    outro.remove();
  });
});
