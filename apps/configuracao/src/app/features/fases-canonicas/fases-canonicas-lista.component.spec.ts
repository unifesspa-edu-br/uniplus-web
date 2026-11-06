import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FasesCanonicasListaComponent } from './fases-canonicas-lista.component';

const fase: FaseCanonicaDto = {
  id: 'f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '',
};

describe('FasesCanonicasListaComponent', () => {
  let fixture: ComponentFixture<FasesCanonicasListaComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FasesCanonicasListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(FasesCanonicasListaComponent);
  });
  function montar(fases: readonly FaseCanonicaDto[], entradas: Record<string, unknown>): void {
    const padrao: Record<string, unknown> = {
      fases,
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
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas }))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const acionaveis = (): HTMLButtonElement[] =>
    botoes().filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true');

  it('com remoção, deixa indisponíveis as ações das linhas e a paginação', () => {
    montar([fase], { removendo: true, gravando: true });
    expect(botoes().length).toBeGreaterThanOrEqual(4);
    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('com remoção, deixa indisponível "Limpar filtros" no estado vazio', () => {
    montar([], { removendo: true, gravando: true, temFiltro: true });
    expect(botoes().find((b) => b.textContent?.includes('Limpar filtros'))?.disabled).toBe(true);
    expect(acionaveis()).toEqual([]);
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([fase], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    fixture.componentRef.setInput('gravando', true);
    fixture.detectChanges();
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('desabilita as ações e recusa acionamentos durante a carga', () => {
    montar([fase], { carregando: true });
    const editados: FaseCanonicaDto[] = [];
    const removidos: FaseCanonicaDto[] = [];
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    const editar = raiz().querySelector<HTMLButtonElement>('button[aria-label^="Editar"]');
    const remover = raiz().querySelector<HTMLButtonElement>('button[aria-label^="Remover"]');
    for (const botao of [editar, remover]) {
      expect(botao?.disabled).toBe(true);
      botao?.click();
    }
    expect(editados).toEqual([]);
    expect(removidos).toEqual([]);
    fixture.componentRef.setInput('carregando', false);
    fixture.detectChanges();
    editar?.click();
    remover?.click();
    expect(editados).toEqual([fase]);
    expect(removidos).toEqual([fase]);
  });

  it('rotula a linha pela escrita em curso, inclusive depois que a gravação termina', () => {
    montar([fase], { gravando: true, andamento: { id: 'f1', rotulo: 'Removendo...' } });
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).toContain('Removendo...');
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).not.toContain('Salvando');
    fixture.componentRef.setInput('andamento', { id: 'outra', rotulo: 'Salvando...' });
    fixture.detectChanges();
    expect(raiz().querySelector('td[data-label="Código"]')?.textContent).not.toContain('...');
  });
  describe('foco depois de uma escrita', () => {
    const botao = (nome: string): HTMLButtonElement => {
      const encontrado = botoes().find((item) => item.getAttribute('aria-label') === nome);
      if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
      return encontrado;
    };
    const editar = (): HTMLButtonElement => botao('Editar fase canônica AVALIACAO');
    const remover = (): HTMLButtonElement => botao('Remover fase canônica AVALIACAO');
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
      montar([fase], {});
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remoção, pelo mesmo rótulo do template', async () => {
      montar([fase], {});
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('localiza a linha pelo id, ainda que a recarga troque o código mostrado', async () => {
      montar([fase], {});
      acionar(editar());
      fixture.componentRef.setInput('gravando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('fases', [{ ...fase, codigo: 'OUTRO_CODIGO' }]);
      fixture.componentRef.setInput('gravando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(botao('Editar fase canônica OUTRO_CODIGO'));
    });

    it('leva o foco ao título da lista quando a linha do acionador não existe mais', async () => {
      montar([fase], {});
      acionar(remover());
      fixture.componentRef.setInput('gravando', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('fases', []);
      fixture.componentRef.setInput('gravando', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-fases-canonicas-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([fase], {});
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([fase], {});
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
