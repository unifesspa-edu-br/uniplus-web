import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposBancaListaComponent } from './tipos-banca-lista.component';

const banca: TipoBancaDto = {
  id: '1',
  codigo: 'BANCA',
  nome: 'Banca',
  faseTipica: null,
  descricao: null,
  criadoEm: '',
};

describe('TiposBancaListaComponent', () => {
  let fixture: ComponentFixture<TiposBancaListaComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposBancaListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TiposBancaListaComponent);
  });
  function montar(bancas: readonly TipoBancaDto[], entradas: Record<string, unknown>): void {
    const padrao: Record<string, unknown> = {
      bancas,
      carregando: false,
      erro: null,
      gravando: false,
      removendo: false,
      temFiltro: false,
      temAnterior: true,
      temProximo: true,
      termoBusca: 'busca',
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas }))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const acionaveis = (): HTMLButtonElement[] =>
    botoes().filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true');

  it('com remoção, deixa indisponíveis as ações das linhas e a paginação', () => {
    montar([banca], { removendo: true, gravando: true });
    expect(botoes().length).toBeGreaterThanOrEqual(4);
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('com remoção, deixa indisponível "Limpar filtros" no estado vazio', () => {
    montar([], { removendo: true, gravando: true, temFiltro: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar filtros'));
    expect(limpar?.matches(':disabled')).toBe(true);
    expect(acionaveis()).toEqual([]);
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([banca], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    fixture.componentRef.setInput('gravando', true);
    fixture.detectChanges();
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('mantém as ações focáveis e recusa acionamentos durante a carga', () => {
    montar([banca], { carregando: true });
    const editados: TipoBancaDto[] = [];
    const removidos: TipoBancaDto[] = [];
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    const editar = raiz().querySelector('button[aria-label^="Editar"]') as HTMLButtonElement;
    const remover = raiz().querySelector('button[aria-label^="Remover"]') as HTMLButtonElement;
    for (const botao of [editar, remover]) {
      expect(botao.matches(':disabled')).toBe(false);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      botao.focus();
      expect(document.activeElement).toBe(botao);
      botao.click();
    }
    expect(editados).toEqual([]);
    expect(removidos).toEqual([]);
    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
    editar.click();
    remover.click();
    expect(editados).toEqual([banca]);
    expect(removidos).toEqual([banca]);
  });

  it('recusa acionamentos durante a gravação, antes de a recarga começar', () => {
    montar([banca], { gravando: true });
    const editados: TipoBancaDto[] = [];
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    raiz().querySelector<HTMLButtonElement>('button[aria-label^="Editar"]')?.click();
    expect(editados).toEqual([]);
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([banca], {});
    const titulo = raiz().querySelector<HTMLElement>('#cfg-tipos-banca-list-title');
    expect(titulo?.getAttribute('tabindex')).toBe('-1');
  });

  describe('foco depois de uma escrita', () => {
    const botao = (nome: string): HTMLButtonElement => {
      const encontrado = botoes().find((item) => item.getAttribute('aria-label') === nome);
      if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
      return encontrado;
    };
    const editar = (): HTMLButtonElement => botao('Editar tipo de banca BANCA');
    const remover = (): HTMLButtonElement => botao('Remover tipo de banca BANCA');
    const acionar = (acionador: HTMLButtonElement): void => {
      acionador.focus();
      acionador.click();
      acionador.blur();
    };
    const concluirEscrita = async (): Promise<void> => {
      fixture.componentRef.setInput('gravando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('gravando', false);
      fixture.detectChanges();
      await fixture.whenStable();
    };
    beforeEach(() => document.body.appendChild(raiz()));
    afterEach(() => raiz().remove());

    it('devolve o foco ao botão de edição que iniciou a escrita quando a recarga termina', async () => {
      montar([banca], {});
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remoção, pelo mesmo rótulo do template', async () => {
      montar([banca], {});
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('leva o foco ao título da lista quando a linha do acionador não existe mais', async () => {
      montar([banca], {});
      acionar(remover());
      fixture.componentRef.setInput('gravando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('bancas', []);
      fixture.componentRef.setInput('gravando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-tipos-banca-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([banca], {});
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([banca], {});
      acionar(editar());
      fixture.componentRef.setInput('carregando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('carregando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
