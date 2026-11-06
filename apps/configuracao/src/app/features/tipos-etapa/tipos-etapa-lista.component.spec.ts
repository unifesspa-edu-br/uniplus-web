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
  const remover = (): HTMLButtonElement => porNome('Remover tipo de etapa PROVA');
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };

  it('com a remoção em curso, todo botão fica indisponível, a busca sai e o título anuncia', () => {
    montar([tipo], { removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio, com a remoção em curso, "Limpar filtros" e "Novo" ficam indisponíveis', () => {
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
    const removidos: TipoEtapaDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));
    const novo = raiz().querySelector<HTMLButtonElement>('#cfg-tipos-etapa-novo');

    for (const botao of [editar(), remover()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo?.getAttribute('aria-disabled')).toBe('true');
    novo?.click();
    expect([editados, removidos, cadastros]).toEqual([[], [], 0]);

    atualizar('carregando', false);
    editar().click();
    remover().click();
    novo?.click();
    expect(editados).toEqual([tipo]);
    expect(removidos).toEqual([tipo]);
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
    montar([tipo], { gravando: true, andamento: { id: 't1', rotulo: 'Removendo...' } });
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).toContain('Removendo...');
    atualizar('andamento', { id: 'outra', rotulo: 'Salvando...' });
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).not.toContain('...');
  });

  it.each([
    [true, false, 'Só compor a nota final'],
    [false, true, 'Só eliminar'],
    [true, true, 'Compor a nota final e eliminar'],
  ])(
    'descreve o que admite (pontuação %s, eliminação %s) como "%s"',
    (admitePontuacao, admiteEliminacao, esperado) => {
      montar([{ ...tipo, admitePontuacao, admiteEliminacao }]);
      expect(raiz().querySelector('td[data-label="O que admite"]')?.textContent?.trim()).toBe(
        esperado,
      );
    },
  );

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

    it('devolve o foco ao botão de remover, pelo mesmo nome do template', async () => {
      montar([tipo]);
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
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
      acionar(remover());
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
