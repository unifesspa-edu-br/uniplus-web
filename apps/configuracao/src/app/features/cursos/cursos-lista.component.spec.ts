import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CursosListaComponent } from './cursos-lista.component';

const curso: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('CursosListaComponent', () => {
  let fixture: ComponentFixture<CursosListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CursosListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CursosListaComponent);
  });

  function montar(cursos: readonly CursoDto[], entradas: Record<string, unknown> = {}): void {
    const padrao: Record<string, unknown> = {
      cursos,
      carregando: false,
      gravando: false,
      removendo: false,
      mensagemDeErro: null,
      temBusca: false,
      limite: 20,
      termoBusca: '',
      temAnterior: true,
      temProximo: true,
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';
  const porNome = (nome: string): HTMLButtonElement => {
    const encontrado = botoes().find((item) => item.getAttribute('aria-label') === nome);
    if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
    return encontrado;
  };
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-cursos-novo') as HTMLButtonElement;
  const editar = (): HTMLButtonElement => porNome('Editar curso ENG-CIV');
  const remover = (): HTMLButtonElement => porNome('Remover curso ENG-CIV');
  const ofertas = (): HTMLButtonElement => porNome('Ofertas de ENG-CIV');

  it('com a remoção em curso, todo botão fica indisponível, a busca sai e o título anuncia', () => {
    montar([curso], { removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(6);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
    expect(raiz().querySelector('.list-state__loading')?.textContent).toContain('Removendo');
  });

  it('no estado vazio, com a remoção em curso, "Limpar busca" e "Novo curso" ficam indisponíveis', () => {
    montar([], { removendo: true, gravando: true, temBusca: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar busca'));
    expect(limpar?.matches(':disabled')).toBe(true);

    atualizar('temBusca', false);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    const cadastros = botoes().filter((b) => b.textContent?.includes('Novo curso'));
    expect(cadastros).toHaveLength(2);
    expect(cadastros.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('sem escrita em curso os acionadores seguem disponíveis', () => {
    montar([curso]);
    expect(botoes().filter(indisponivel)).toEqual([]);
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([curso], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    atualizar('gravando', true);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('limita a busca a 200 caracteres, o que a API aceita em q', () => {
    montar([curso]);
    expect(raiz().querySelector('ui-filter-bar input')?.getAttribute('maxlength')).toBe('200');
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([curso], { carregando: true });
    const editados: CursoDto[] = [];
    const removidos: CursoDto[] = [];
    const comOfertas: CursoDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    fixture.componentInstance.verOfertas.subscribe((item) => comOfertas.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));

    for (const botao of [editar(), remover(), ofertas()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo().getAttribute('aria-disabled')).toBe('true');
    novo().click();
    expect([editados, removidos, comOfertas, cadastros]).toEqual([[], [], [], 0]);

    atualizar('carregando', false);
    editar().click();
    remover().click();
    ofertas().click();
    novo().click();
    expect([editados, removidos, comOfertas, cadastros]).toEqual([[curso], [curso], [curso], 1]);
  });

  it('o novo curso continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([curso], { gravando: true });
    document.body.appendChild(raiz());
    novo().focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([curso]);
    expect(raiz().querySelector('#cfg-cursos-list-title')?.getAttribute('tabindex')).toBe('-1');
  });

  it('usa a classe de carregamento que o estilo da lista define, com o spinner pequeno', () => {
    montar([curso], { carregando: true });
    const carregamento = raiz().querySelector('.list-state__loading');
    expect(carregamento?.textContent).toContain('Carregando');
    expect(carregamento?.querySelector('.spinner--sm')).not.toBeNull();
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
      montar([curso]);
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remover, pelo mesmo nome do template', async () => {
      montar([curso]);
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([curso]);
      acionar(novo());
      await concluirEscrita();
      expect(document.activeElement).toBe(novo());
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([curso]);
      acionar(remover());
      atualizar('gravando', true);
      atualizar('cursos', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-cursos-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([curso]);
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([curso]);
      acionar(editar());
      atualizar('carregando', true);
      atualizar('carregando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
