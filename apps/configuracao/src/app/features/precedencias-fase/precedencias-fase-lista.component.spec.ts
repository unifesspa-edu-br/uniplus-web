import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrecedenciasFaseListaComponent } from './precedencias-fase-lista.component';

const aresta: PrecedenciaFaseDto = {
  id: 'a1',
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: true,
  criadoEm: '',
};

describe('PrecedenciasFaseListaComponent', () => {
  let fixture: ComponentFixture<PrecedenciasFaseListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrecedenciasFaseListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(PrecedenciasFaseListaComponent);
  });

  function montar(
    arestas: readonly PrecedenciaFaseDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      arestas,
      nomesDasFases: new Map([['INSCRICAO', 'Inscrição']]),
      carregando: false,
      gravando: false,
      removendo: false,
      andamento: null,
      erro: null,
      temFiltro: false,
      temAnterior: true,
      temProximo: true,
      termoBusca: 'busca',
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const indisponivel = (b: HTMLButtonElement): boolean =>
    b.matches(':disabled') || b.getAttribute('aria-disabled') === 'true';
  const porNome = (nome: string): HTMLButtonElement => {
    const encontrado = botoes().find((item) => item.getAttribute('aria-label') === nome);
    if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
    return encontrado;
  };
  const editar = (): HTMLButtonElement =>
    porNome('Editar precedência entre INSCRICAO e HOMOLOGACAO');
  const remover = (): HTMLButtonElement =>
    porNome('Remover precedência entre INSCRICAO e HOMOLOGACAO');
  const novo = (): HTMLButtonElement | null =>
    raiz().querySelector<HTMLButtonElement>('#cfg-precedencias-fase-nova');
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };

  it('mostra o par com o nome da fase, quando conhecido, e a sobreposição', () => {
    montar([aresta]);
    const antecessora = raiz().querySelector('td[data-label="Fase antecessora"]');
    expect(antecessora?.textContent).toContain('INSCRICAO');
    expect(antecessora?.textContent).toContain('Inscrição');
    expect(raiz().querySelector('td[data-label="Fase sucessora"]')?.textContent?.trim()).toBe(
      'HOMOLOGACAO',
    );
    expect(raiz().querySelector('td[data-label="Permite sobreposição"]')?.textContent).toContain(
      'Sim',
    );
  });

  it('com a remoção em curso, todo botão fica indisponível, a busca sai e o título anuncia', () => {
    montar([aresta], { removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio, com a remoção em curso, "Limpar busca" e "Nova aresta" ficam indisponíveis', () => {
    montar([], { removendo: true, gravando: true, temFiltro: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar busca'));
    expect(limpar?.matches(':disabled')).toBe(true);

    atualizar('temFiltro', false);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().textContent).toContain('Nenhuma aresta de precedência cadastrada');
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([aresta], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    atualizar('gravando', true);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([aresta], { carregando: true });
    const editadas: PrecedenciaFaseDto[] = [];
    const removidas: PrecedenciaFaseDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editadas.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidas.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));

    for (const botao of [editar(), remover()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo()?.getAttribute('aria-disabled')).toBe('true');
    novo()?.click();
    expect([editadas, removidas, cadastros]).toEqual([[], [], 0]);

    atualizar('carregando', false);
    editar().click();
    remover().click();
    novo()?.click();
    expect(editadas).toEqual([aresta]);
    expect(removidas).toEqual([aresta]);
    expect(cadastros).toBe(1);
  });

  it('o novo cadastro continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([aresta], { gravando: true });
    document.body.appendChild(raiz());
    novo()?.focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('rotula só a linha da escrita em curso', () => {
    montar([aresta], { gravando: true, andamento: { id: 'a1', rotulo: 'Removendo...' } });
    const celula = (): string | null | undefined =>
      raiz().querySelector('td[data-label="Fase antecessora"]')?.textContent;
    expect(celula()).toContain('Removendo...');
    atualizar('andamento', { id: 'outra', rotulo: 'Salvando...' });
    expect(celula()).not.toContain('...');
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([aresta]);
    expect(
      raiz().querySelector('#cfg-precedencias-fase-list-title')?.getAttribute('tabindex'),
    ).toBe('-1');
  });

  it('oferece a paginação só quando há outra página', () => {
    montar([aresta], { temAnterior: false, temProximo: false });
    expect(raiz().querySelector('ui-pager')).toBeNull();
    atualizar('temProximo', true);
    expect(raiz().querySelector('ui-pager')).not.toBeNull();
  });

  describe('foco depois de uma escrita', () => {
    const acionar = (acionador: HTMLButtonElement): void => {
      acionador.focus();
      acionador.click();
      acionador.blur();
    };
    const concluirEscrita = async (): Promise<void> => {
      atualizar('gravando', true);
      atualizar('gravando', false);
      await fixture.whenStable();
    };
    beforeEach(() => document.body.appendChild(raiz()));
    afterEach(() => raiz().remove());

    it('devolve o foco ao botão de edição que iniciou a escrita', async () => {
      montar([aresta]);
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remover, pelo mesmo nome do template', async () => {
      montar([aresta]);
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([aresta]);
      acionar(novo() as HTMLButtonElement);
      await concluirEscrita();
      expect(document.activeElement).toBe(novo());
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([aresta]);
      acionar(remover());
      atualizar('gravando', true);
      atualizar('arestas', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(
        raiz().querySelector('#cfg-precedencias-fase-list-title'),
      );
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([aresta]);
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([aresta]);
      acionar(editar());
      atualizar('carregando', true);
      atualizar('carregando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
