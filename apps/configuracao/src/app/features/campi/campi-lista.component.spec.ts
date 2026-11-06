import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CampiListaComponent } from './campi-lista.component';

const campus: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('CampiListaComponent — remoção em curso', () => {
  let fixture: ComponentFixture<CampiListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CampiListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CampiListaComponent);
  });

  function montar(
    campi: readonly CampusDto[],
    removendo: boolean,
    paginas = false,
    carregando = false,
  ): void {
    const entradas: Record<string, unknown> = {
      campi,
      carregando,
      gravando: removendo,
      removendo,
      anuncioDoResultado: '',
      mensagemDeErro: null,
      temAnterior: paginas,
      temProximo: paginas,
    };
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }

  const botoes = (): HTMLButtonElement[] => [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
  ];
  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';

  it('com itens e paginação, todo acionador fica indisponível', () => {
    montar([campus], true, true);

    expect(botoes().length).toBeGreaterThan(3);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
  });

  it('no estado vazio, o acionador de cadastro também fica indisponível', () => {
    montar([], true);

    const cadastros = botoes().filter((b) => b.textContent?.includes('Novo campus'));
    expect(cadastros).toHaveLength(2);
    expect(cadastros.every((b) => b.matches(':disabled'))).toBe(true);
  });

  it('sem remoção em curso os acionadores seguem disponíveis', () => {
    montar([], false);

    expect(botoes().some(indisponivel)).toBe(false);
  });

  it('com a lista carregando, os acionadores da linha e a paginação ficam indisponíveis', () => {
    montar([campus], false, true, true);

    const indisponiveis = botoes().filter(indisponivel);
    expect(indisponiveis.length).toBeGreaterThanOrEqual(4);
    expect(
      botoes()
        .filter((b) => b.textContent?.includes('Novo campus'))[0]
        .matches(':disabled'),
    ).toBe(false);
  });

  it('anuncia o resultado numa região de status e esconde o texto visual da remoção', () => {
    montar([campus], true);
    fixture.componentRef.setInput('anuncioDoResultado', 'Campus MARABA removido.');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.sr-only[role="status"]')?.textContent?.trim()).toBe(
      'Campus MARABA removido.',
    );
    expect(raiz.querySelector('.list-state__loading')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('foco depois de uma escrita', () => {
    const rotulo = 'Remover campus MARABA';
    let anfitriao: HTMLElement;

    beforeEach(() => {
      anfitriao = document.createElement('div');
      document.body.append(anfitriao);
      anfitriao.append(fixture.nativeElement);
    });

    afterEach(() => anfitriao.remove());

    const botaoDaLinha = (): HTMLButtonElement =>
      (fixture.nativeElement as HTMLElement).querySelector(
        `button[aria-label="${rotulo}"]`,
      ) as HTMLButtonElement;

    const titulo = (): HTMLElement =>
      (fixture.nativeElement as HTMLElement).querySelector('#cfg-campi-list-title') as HTMLElement;

    async function gravar(concluida: boolean, camposDepois: readonly CampusDto[]): Promise<void> {
      montar([campus], false);
      botaoDaLinha().click();
      fixture.componentRef.setInput('gravando', true);
      fixture.componentRef.setInput('removendo', true);
      fixture.detectChanges();
      expect(botaoDaLinha().matches(':disabled')).toBe(true);
      fixture.componentRef.setInput('gravando', false);
      fixture.componentRef.setInput('removendo', false);
      fixture.componentRef.setInput('campi', camposDepois);
      fixture.componentRef.setInput('carregando', concluida);
      fixture.detectChanges();
      fixture.componentRef.setInput('carregando', false);
      fixture.detectChanges();
      await TestBed.inject(ApplicationRef).whenStable();
    }

    it('volta ao botão da linha que acionou a escrita', async () => {
      await gravar(true, [campus]);

      expect(document.activeElement).toBe(botaoDaLinha());
    });

    it('vai ao título da lista quando a linha deixou de existir', async () => {
      await gravar(true, []);

      expect(document.activeElement).toBe(titulo());
      expect(titulo().getAttribute('tabindex')).toBe('-1');
    });

    it('não toma o foco de quem o levou para outro ponto', async () => {
      const outro = document.createElement('button');
      anfitriao.append(outro);
      montar([campus], false);
      botaoDaLinha().click();
      fixture.componentRef.setInput('gravando', true);
      fixture.componentRef.setInput('removendo', true);
      fixture.detectChanges();
      outro.focus();
      fixture.componentRef.setInput('gravando', false);
      fixture.componentRef.setInput('removendo', false);
      fixture.detectChanges();
      await TestBed.inject(ApplicationRef).whenStable();

      expect(document.activeElement).toBe(outro);
    });
  });
});
