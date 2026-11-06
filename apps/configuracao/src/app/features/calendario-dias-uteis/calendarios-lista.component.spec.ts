import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarioDiasUteisResumoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CalendariosListaComponent } from './calendarios-lista.component';
import { CALENDARIO_ANTERIOR, CALENDARIO_VIGENTE, TITULO_DA_LISTA } from './calendarios.testing';

describe('CalendariosListaComponent', () => {
  let fixture: ComponentFixture<CalendariosListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendariosListaComponent],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    fixture = TestBed.createComponent(CalendariosListaComponent);
  });

  function montar(
    calendarios: readonly CalendarioDiasUteisResumoDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      calendarios,
      carregando: false,
      gravando: false,
      removendo: false,
      andamento: null,
      erro: null,
      temAnterior: true,
      temProximo: true,
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const acionaveis = (): HTMLElement[] => [...raiz().querySelectorAll<HTMLElement>('button, a')];
  const indisponivel = (item: HTMLElement): boolean =>
    item.matches(':disabled') || item.getAttribute('aria-disabled') === 'true';
  const porNome = (nome: string): HTMLButtonElement => {
    const encontrado = raiz().querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`);
    if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
    return encontrado;
  };
  const marcarVigente = (): HTMLButtonElement => porNome('Marcar vigente 2025.2');
  const remover = (): HTMLButtonElement => porNome('Remover calendário 2025.2');
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };

  it('com a remoção em curso, todo botão e link fica indisponível, a paginação inclusive, e o título anuncia', () => {
    montar([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR], { removendo: true, gravando: true });

    expect(acionaveis().length).toBeGreaterThanOrEqual(8);
    expect(acionaveis().filter((item) => !indisponivel(item))).toEqual([]);
    expect(raiz().querySelector('[data-pager="next"]')).not.toBeNull();
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio, com a escrita em curso, o convite a cadastrar fica indisponível', () => {
    montar([], { gravando: true, temAnterior: false, temProximo: false });

    const convite = raiz().querySelector<HTMLAnchorElement>('ui-empty-state a');
    expect(convite?.getAttribute('aria-disabled')).toBe('true');
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    convite?.dispatchEvent(clique);
    expect(clique.defaultPrevented).toBe(true);
    expect(raiz().textContent).toContain('Nenhum calendário encontrado');

    atualizar('gravando', false);
    expect(raiz().querySelector('ui-empty-state a')?.getAttribute('aria-disabled')).toBeNull();
  });

  it('desabilita no DOM as ações da linha durante a carga e recusa o acionamento', () => {
    montar([CALENDARIO_ANTERIOR], { carregando: true });
    const removidos: CalendarioDiasUteisResumoDto[] = [];
    const marcados: CalendarioDiasUteisResumoDto[] = [];
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    fixture.componentInstance.marcarVigente.subscribe((item) => marcados.push(item));

    for (const botao of [marcarVigente(), remover()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect([removidos, marcados]).toEqual([[], []]);

    atualizar('carregando', false);
    marcarVigente().click();
    remover().click();
    expect(marcados).toEqual([CALENDARIO_ANTERIOR]);
    expect(removidos).toEqual([CALENDARIO_ANTERIOR]);
  });

  it('o calendário vigente tem marcar vigente e remover indisponíveis mesmo sem escrita em curso', () => {
    montar([CALENDARIO_VIGENTE]);

    expect(porNome('Marcar vigente 2026.1').matches(':disabled')).toBe(true);
    expect(porNome('Remover calendário 2026.1').matches(':disabled')).toBe(true);
  });

  it('visualizar só fica indisponível com escrita em curso, não durante a carga', () => {
    montar([CALENDARIO_ANTERIOR], { carregando: true });
    const link = (): HTMLElement =>
      raiz().querySelector<HTMLElement>(
        'a[aria-label="Visualizar calendário 2025.2"]',
      ) as HTMLElement;
    expect(link().getAttribute('aria-disabled')).toBeNull();

    atualizar('gravando', true);
    expect(link().getAttribute('aria-disabled')).toBe('true');
  });

  it('o link de cadastro navega quando nada está sendo gravado', () => {
    montar([], { temAnterior: false, temProximo: false });

    const convite = raiz().querySelector<HTMLAnchorElement>('ui-empty-state a');
    expect(convite?.getAttribute('href')).toBe('/calendario-dias-uteis/novo');
    expect(convite?.getAttribute('aria-disabled')).toBeNull();
    expect(convite?.hasAttribute('tabindex')).toBe(false);
    convite?.click();
  });

  it('rotula só a linha da escrita em curso', () => {
    montar([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR], {
      gravando: true,
      andamento: { id: CALENDARIO_ANTERIOR.id, rotulo: 'Removendo...' },
    });
    const versoes = [...raiz().querySelectorAll('td[data-label="Versão"]')];
    expect(versoes[0].textContent).not.toContain('...');
    expect(versoes[1].textContent).toContain('Removendo...');
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([CALENDARIO_ANTERIOR]);
    expect(raiz().querySelector(TITULO_DA_LISTA)?.getAttribute('tabindex')).toBe('-1');
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

    it('devolve o foco ao botão de remover que iniciou a escrita', async () => {
      montar([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);
      acionar(remover());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('leva o foco ao título quando a linha removida não existe mais', async () => {
      montar([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);
      acionar(remover());
      atualizar('calendarios', [CALENDARIO_VIGENTE]);
      await concluirEscrita();
      expect(document.activeElement).toBe(raiz().querySelector(TITULO_DA_LISTA));
    });

    it('depois de marcar vigente, o botão da linha segue indisponível e o foco vai ao título', async () => {
      montar([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);
      acionar(marcarVigente());
      atualizar('calendarios', [
        { ...CALENDARIO_VIGENTE, vigente: false },
        { ...CALENDARIO_ANTERIOR, vigente: true },
      ]);
      await concluirEscrita();
      expect(document.activeElement).toBe(raiz().querySelector(TITULO_DA_LISTA));
    });
  });
});
