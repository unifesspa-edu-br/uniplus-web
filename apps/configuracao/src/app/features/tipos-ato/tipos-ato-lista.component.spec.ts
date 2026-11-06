import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposAtoListaComponent } from './tipos-ato-lista.component';
import { aviso, preliminar } from './tipos-ato.testing';

describe('TiposAtoListaComponent', () => {
  let fixture: ComponentFixture<TiposAtoListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposAtoListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TiposAtoListaComponent);
  });

  function montar(
    atos: readonly TipoAtoPublicadoDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      atos,
      carregando: false,
      gravando: false,
      removendo: false,
      erro: null,
      temAnterior: false,
      temProximo: false,
      termoBusca: '',
      somenteEmVigor: false,
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
    porNome('Editar tipo de ato AVISO, vigência iniciada em 01/01/2026');
  const remover = (): HTMLButtonElement =>
    porNome('Remover vigência do tipo de ato AVISO, vigência iniciada em 01/01/2026');
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-tipos-ato-novo') as HTMLButtonElement;

  it('com a remoção em curso, todo botão fica indisponível, a busca e o recorte saem e o título anuncia', () => {
    montar([aviso], { removendo: true, gravando: true, temProximo: true });

    expect(botoes().length).toBeGreaterThanOrEqual(5);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().querySelector('.cfg-tipos-ato__historico')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio, com a remoção em curso, "Limpar filtros" e "Novo" ficam indisponíveis', () => {
    montar([], { removendo: true, gravando: true, somenteEmVigor: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar filtros'));
    expect(limpar?.matches(':disabled')).toBe(true);

    atualizar('somenteEmVigor', false);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().textContent).toContain('Nenhum tipo de ato cadastrado');
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([aviso], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    atualizar('gravando', true);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([aviso], { carregando: true });
    const editados: TipoAtoPublicadoDto[] = [];
    const removidos: TipoAtoPublicadoDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));

    for (const botao of [editar(), remover()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo().getAttribute('aria-disabled')).toBe('true');
    novo().click();
    expect([editados, removidos, cadastros]).toEqual([[], [], 0]);

    atualizar('carregando', false);
    editar().click();
    remover().click();
    novo().click();
    expect(editados).toEqual([aviso]);
    expect(removidos).toEqual([aviso]);
    expect(cadastros).toBe(1);
  });

  it('o novo cadastro continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([aviso], { gravando: true });
    document.body.appendChild(raiz());
    novo().focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([aviso]);
    expect(raiz().querySelector('#cfg-tipos-ato-list-title')?.getAttribute('tabindex')).toBe('-1');
  });

  it('nomeia cada ação pela vigência, para o mesmo código não repetir o nome', () => {
    const outra = { ...aviso, id: 'outra', vigenciaInicio: '2026-07-01', vigenciaFim: null };
    montar([aviso, outra]);

    const nomes = botoes()
      .map((b) => b.getAttribute('aria-label'))
      .filter((nome) => nome?.startsWith('Remover'));
    expect(nomes).toEqual([
      'Remover vigência do tipo de ato AVISO, vigência iniciada em 01/01/2026',
      'Remover vigência do tipo de ato AVISO, vigência iniciada em 01/07/2026',
    ]);
  });

  describe('recorte e busca', () => {
    it('o recorte das vigências em vigor alterna o modelo', () => {
      montar([aviso]);
      raiz().querySelector<HTMLElement>('label.checkbox')?.click();
      expect(fixture.componentInstance.somenteEmVigor()).toBe(true);
    });

    it('busca com mais de uma página avisa que o recorte só alcança a carregada', () => {
      montar([aviso], { termoBusca: 'av' });
      expect(raiz().textContent).not.toContain('a busca alcança só a que está carregada');
      atualizar('temProximo', true);
      expect(raiz().textContent).toContain('a busca alcança só a que está carregada');
      atualizar('termoBusca', '');
      expect(raiz().textContent).not.toContain('a busca alcança só a que está carregada');
    });

    it('"Limpar filtros" zera a busca e o recorte', () => {
      montar([], { termoBusca: 'zzz', somenteEmVigor: true });
      const limpar = botoes().find((b) => b.textContent?.includes('Limpar filtros'));
      limpar?.click();
      expect(fixture.componentInstance.termoBusca()).toBe('');
      expect(fixture.componentInstance.somenteEmVigor()).toBe(false);
    });
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
      montar([aviso, preliminar]);
      acionar(editar());
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remover, pelo mesmo nome do template', async () => {
      montar([aviso, preliminar]);
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([aviso]);
      acionar(novo());
      await concluirEscrita();
      expect(document.activeElement).toBe(novo());
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([aviso]);
      acionar(remover());
      atualizar('gravando', true);
      atualizar('atos', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-tipos-ato-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([aviso]);
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });
  });
});
