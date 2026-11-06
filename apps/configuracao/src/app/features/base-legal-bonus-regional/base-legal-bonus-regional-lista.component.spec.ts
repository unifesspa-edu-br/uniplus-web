import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import { BaseLegalBonusRegionalDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseLegalBonusRegionalListaComponent } from './base-legal-bonus-regional-lista.component';
import { decreto, portaria } from './base-legal-bonus-regional.testing';

const resolvido = (rotulo: string): ResolucaoDeVinculo => ({ estado: 'resolvido', rotulo });

describe('BaseLegalBonusRegionalListaComponent', () => {
  let fixture: ComponentFixture<BaseLegalBonusRegionalListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BaseLegalBonusRegionalListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(BaseLegalBonusRegionalListaComponent);
  });

  function montar(
    bases: readonly BaseLegalBonusRegionalDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      bases,
      carregando: false,
      gravando: false,
      removendo: false,
      erro: null,
      temFiltro: false,
      temAnterior: false,
      temProximo: false,
      rotuloDoTipo: (codigo: string) => resolvido(codigo === 'LEI' ? 'Lei' : 'Portaria'),
      termoBusca: '',
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
  const editar = (): HTMLButtonElement => porNome(`Editar base legal ${decreto.identificacao}`);
  const remover = (): HTMLButtonElement =>
    porNome(`Remover base legal de bônus regional ${decreto.identificacao}`);
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-base-legal-novo') as HTMLButtonElement;

  it('com a remoção em curso, todo botão fica indisponível, a busca sai e o título anuncia', () => {
    montar([decreto], { removendo: true, gravando: true, temProximo: true });

    expect(botoes().length).toBeGreaterThanOrEqual(4);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio, com a remoção em curso, "Limpar busca" e "Cadastrar" ficam indisponíveis', () => {
    montar([], { removendo: true, gravando: true, temFiltro: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar busca'));
    expect(limpar?.matches(':disabled')).toBe(true);

    atualizar('temFiltro', false);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().textContent).toContain('Nenhuma base legal cadastrada');
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([decreto], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    atualizar('gravando', true);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([decreto], { carregando: true });
    const editados: BaseLegalBonusRegionalDto[] = [];
    const removidos: BaseLegalBonusRegionalDto[] = [];
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
    expect(editados).toEqual([decreto]);
    expect(removidos).toEqual([decreto]);
    expect(cadastros).toBe(1);
  });

  it('o novo cadastro continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([decreto], { gravando: true });
    document.body.appendChild(raiz());
    novo().focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([decreto]);
    expect(raiz().querySelector('#cfg-base-legal-list-title')?.getAttribute('tabindex')).toBe('-1');
  });

  it('mostra o rótulo do tipo que a página resolveu, e o estado do vocabulário quando não resolveu', () => {
    montar([portaria, decreto], {
      rotuloDoTipo: (codigo: string): ResolucaoDeVinculo =>
        codigo === 'LEI' ? resolvido('Lei') : { estado: 'falhou', rotulo: '' },
    });

    const tipos = [...raiz().querySelectorAll('tbody tr')].map((linha) =>
      linha.querySelector('td')?.textContent?.trim(),
    );
    expect(tipos).toEqual(['Não carregado', 'Lei']);
  });

  it('"Limpar busca" zera o termo', () => {
    montar([], { termoBusca: 'zzz', temFiltro: true });
    botoes()
      .find((b) => b.textContent?.includes('Limpar busca'))
      ?.click();
    expect(fixture.componentInstance.termoBusca()).toBe('');
  });

  it('mostra a paginação só quando há outra página, e a desabilita durante a carga', () => {
    montar([decreto]);
    expect(raiz().querySelector('ui-pager')).toBeNull();

    atualizar('temProximo', true);
    atualizar('carregando', true);
    const pager = [...raiz().querySelectorAll('ui-pager button')] as HTMLButtonElement[];
    expect(pager.length).toBeGreaterThan(0);
    expect(pager.filter((b) => !indisponivel(b))).toEqual([]);
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
      montar([decreto, portaria]);
      acionar(editar());
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remover, pelo mesmo nome do template', async () => {
      montar([decreto, portaria]);
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([decreto]);
      acionar(novo());
      await concluirEscrita();
      expect(document.activeElement).toBe(novo());
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([decreto]);
      acionar(remover());
      atualizar('gravando', true);
      atualizar('bases', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-base-legal-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([decreto]);
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
