import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposProcessoListaComponent } from './tipos-processo-lista.component';

const ativo: TipoProcessoDto = {
  id: 't1',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: null,
  ativo: true,
  criadoEm: '',
};
const desativado: TipoProcessoDto = { ...ativo, id: 't2', codigo: 'ENEM', ativo: false };

describe('TiposProcessoListaComponent', () => {
  let fixture: ComponentFixture<TiposProcessoListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposProcessoListaComponent],
      providers: [provideRouter([]), { provide: PermissoesService, useValue: { tem: () => true } }],
    });
    fixture = TestBed.createComponent(TiposProcessoListaComponent);
  });

  function montar(tipos: readonly TipoProcessoDto[], entradas: Record<string, unknown> = {}): void {
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
      descricaoVazia: 'Cadastre o primeiro.',
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
  const editar = (): HTMLButtonElement => porNome('Editar tipo de processo SISU');
  const desativar = (): HTMLButtonElement => porNome('Desativar tipo de processo SISU');
  const reativar = (): HTMLButtonElement => porNome('Reativar tipo de processo ENEM');
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-tipos-processo-novo') as HTMLButtonElement;
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };

  it('com a desativação em curso, todo botão fica indisponível, a busca sai e o título anuncia', () => {
    montar([ativo, desativado], { removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(6);
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
    expect(raiz().textContent).toContain('Nenhum tipo de processo cadastrado');
    expect(raiz().textContent).toContain('Cadastre o primeiro.');
  });

  it('mantém a busca editável durante a carga e só a retira durante a gravação', () => {
    montar([ativo], { carregando: true });
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(false);
    atualizar('gravando', true);
    expect(raiz().querySelector('ui-filter-bar')?.hasAttribute('inert')).toBe(true);
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([ativo, desativado], { carregando: true });
    const editados: TipoProcessoDto[] = [];
    const desativados: TipoProcessoDto[] = [];
    const reativados: TipoProcessoDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => desativados.push(item));
    fixture.componentInstance.reativar.subscribe((item) => reativados.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));

    for (const botao of [editar(), desativar(), reativar()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo().getAttribute('aria-disabled')).toBe('true');
    novo().click();
    expect([editados, desativados, reativados, cadastros]).toEqual([[], [], [], 0]);

    atualizar('carregando', false);
    editar().click();
    desativar().click();
    reativar().click();
    novo().click();
    expect(editados).toEqual([ativo]);
    expect(desativados).toEqual([ativo]);
    expect(reativados).toEqual([desativado]);
    expect(cadastros).toBe(1);
  });

  it('o novo cadastro continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([ativo], { gravando: true });
    document.body.appendChild(raiz());
    novo().focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('rotula só a linha da escrita em curso', () => {
    montar([ativo, desativado], { gravando: true, andamento: { id: 't1', rotulo: 'Salvando...' } });
    const situacoes = [...raiz().querySelectorAll('td[data-label="Situação"]')];
    expect(situacoes[0].textContent).toContain('Salvando...');
    expect(situacoes[1].textContent).not.toContain('...');
  });

  it('oferece desativar ao tipo ativo e reativar ao desativado, e descreve a situação de cada um', () => {
    montar([ativo, desativado]);
    expect(raiz().querySelector('[aria-label="Reativar tipo de processo SISU"]')).toBeNull();
    expect(raiz().querySelector('[aria-label="Desativar tipo de processo ENEM"]')).toBeNull();
    expect(raiz().querySelector('[aria-label="Editar tipo de processo ENEM"]')).toBeNull();
    expect(raiz().textContent).toContain('Ativo');
    expect(raiz().textContent).toContain('Desativado');
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([ativo]);
    expect(raiz().querySelector('#cfg-tipos-processo-list-title')?.getAttribute('tabindex')).toBe(
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
      montar([ativo]);
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de desativar, pelo mesmo nome do template', async () => {
      montar([ativo]);
      acionar(desativar());
      await concluirEscrita();
      expect(document.activeElement).toBe(desativar());
    });

    it('devolve o foco ao botão de reativar, pelo mesmo nome do template', async () => {
      montar([desativado]);
      acionar(reativar());
      await concluirEscrita();
      expect(document.activeElement).toBe(reativar());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([ativo]);
      acionar(novo());
      await concluirEscrita();
      expect(document.activeElement).toBe(novo());
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([ativo]);
      acionar(desativar());
      atualizar('gravando', true);
      atualizar('tipos', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-tipos-processo-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([ativo]);
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([ativo]);
      acionar(editar());
      atualizar('carregando', true);
      atualizar('carregando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
