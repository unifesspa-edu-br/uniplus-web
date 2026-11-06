import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposEtapaListaComponent } from './tipos-etapa-lista.component';

const tipo: TipoEtapaDto = {
  id: 't1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  admitePontuacao: true,
  admiteEliminacao: false,
  notaDeOrigemNoEnem: false,
  criadoEm: '',
};

describe('TiposEtapaListaComponent', () => {
  let fixture: ComponentFixture<TiposEtapaListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposEtapaListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TiposEtapaListaComponent);
  });

  function montar(tipos: readonly TipoEtapaDto[], entradas: Record<string, unknown> = {}): void {
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
  const editar = (): HTMLButtonElement => porNome('Editar tipo de etapa PROVA');
  const desativar = (): HTMLButtonElement => porNome('Desativar tipo de etapa PROVA');
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };

  it('com a desativação em curso, todo botão fica indisponível, a busca sai e o título anuncia', () => {
    montar([tipo], { removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Desativando');
  });

  it('no estado vazio, com a desativação em curso, "Limpar filtros" e "Novo" ficam indisponíveis', () => {
    montar([], { removendo: true, gravando: true, temFiltro: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar filtros'));
    expect(limpar?.matches(':disabled')).toBe(true);

    atualizar('temFiltro', false);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().textContent).toContain('Nenhum tipo de etapa cadastrado');
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([tipo], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    atualizar('gravando', true);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([tipo], { carregando: true });
    const editados: TipoEtapaDto[] = [];
    const desativados: TipoEtapaDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => desativados.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));
    const novo = raiz().querySelector<HTMLButtonElement>('#cfg-tipos-etapa-novo');

    for (const botao of [editar(), desativar()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo?.getAttribute('aria-disabled')).toBe('true');
    novo?.click();
    expect([editados, desativados, cadastros]).toEqual([[], [], 0]);

    atualizar('carregando', false);
    editar().click();
    desativar().click();
    novo?.click();
    expect(editados).toEqual([tipo]);
    expect(desativados).toEqual([tipo]);
    expect(cadastros).toBe(1);
  });

  it('o novo cadastro continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([tipo], { gravando: true });
    document.body.appendChild(raiz());
    const novo = raiz().querySelector<HTMLButtonElement>('#cfg-tipos-etapa-novo');
    novo?.focus();
    expect(document.activeElement).toBe(novo);
    raiz().remove();
  });

  it('rotula só a linha da escrita em curso', () => {
    montar([tipo], { gravando: true, andamento: { id: 't1', rotulo: 'Desativando...' } });
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).toContain(
      'Desativando...',
    );
    atualizar('andamento', { id: 'outra', rotulo: 'Salvando...' });
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).not.toContain('...');
  });

  it('não oferece desativar o tipo inativo e o descreve como inativo', () => {
    montar([{ ...tipo, ativo: false }]);
    expect(raiz().querySelector('[aria-label^="Desativar"]')).toBeNull();
    expect(raiz().textContent).toContain('Desativado');
    expect(raiz().textContent).toContain('Só compor a nota final');
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([tipo]);
    expect(raiz().querySelector('#cfg-tipos-etapa-list-title')?.getAttribute('tabindex')).toBe(
      '-1',
    );
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
      montar([tipo]);
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de desativar, pelo mesmo nome do template', async () => {
      montar([tipo]);
      acionar(desativar());
      await concluirEscrita();
      expect(document.activeElement).toBe(desativar());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([tipo]);
      const novo = raiz().querySelector<HTMLButtonElement>('#cfg-tipos-etapa-novo');
      acionar(novo as HTMLButtonElement);
      await concluirEscrita();
      expect(document.activeElement).toBe(novo);
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([tipo]);
      acionar(desativar());
      atualizar('gravando', true);
      atualizar('tipos', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-tipos-etapa-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([tipo]);
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([tipo]);
      acionar(editar());
      atualizar('carregando', true);
      atualizar('carregando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
