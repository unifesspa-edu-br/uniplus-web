import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ROTULOS_DOS_PASSOS } from './wizard/processo-seletivo.data';
import { configurarPagina, montarPagina } from './processo-seletivo.page.testing';

describe('ProcessoSeletivoPage — publicação: pendências do rascunho', () => {
  beforeEach(configurarPagina);

  it('recusa publicar rascunho vazio alcançado por salto de passo', async () => {
    const { fixture, page, store } = montarPagina();

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();

    const erros = store.erroDoPasso();
    expect(erros).not.toBeNull();
    expect(erros?.length).toBeGreaterThan(0);
    expect(erros?.[0]).toContain('Passo 1');
  });

  it('traz o aviso de pendências para a vista e para o foco', async () => {
    const { fixture, page, store } = montarPagina();

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    const alerta = (fixture.nativeElement as HTMLElement).querySelector('.step-error');
    expect(alerta).not.toBeNull();
    expect(alerta?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(alerta);
  });

  it('ao bloquear o avanço com campo inválido, rola o campo para a vista e o foca', async () => {
    const { fixture, page, store } = montarPagina();
    const rolagem = vi.fn();
    HTMLElement.prototype.scrollIntoView = rolagem;

    store.goTo(1);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      '.step-pane:not([hidden]) [aria-invalid="true"]',
    );
    expect(campo).not.toBeNull();
    expect(rolagem).toHaveBeenCalledWith({ block: 'center' });
    expect(document.activeElement).toBe(campo);
  });

  it('não leva o foco a campo inválido escondido e mantém o campo inválido que já tem o foco', async () => {
    const { fixture, page, store } = montarPagina();
    const raiz = fixture.nativeElement as HTMLElement;
    const painel = document.createElement('div');
    painel.className = 'step-pane';
    painel.innerHTML =
      '<div hidden><input id="escondido" aria-invalid="true" /></div><input id="atual" aria-invalid="true" /><input id="outro" aria-invalid="true" />';
    raiz.appendChild(painel);
    const atual = painel.querySelector<HTMLInputElement>('#atual') as HTMLInputElement;
    atual.focus();

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    expect(document.activeElement).toBe(atual);
    painel.remove();
  });

  describe('número inválido no formulário', () => {
    const conteudoComLimiteInvalido = () => ({
      titulo: null,
      etapas: [
        {
          codigo: 'S1',
          ordem: 0,
          tipo: 'SECAO',
          bloco: null,
          titulo: 'Escolaridade',
          descricao: null,
          aviso: null,
        },
      ],
      itens: [
        {
          fatoCodigo: 'NOTA',
          ordem: 0,
          rotulo: 'Nota',
          tipoRenderizacao: 'TEXTO',
          obrigatoriedade: 'SEMPRE',
          precondicao: null,
          etapaCodigo: 'S1',
          pedirConfirmacao: false,
          restricoes: [{ tipo: 'TAMANHO_TEXTO', minimo: 'dez', maximo: null }],
        },
      ],
      termos: [],
      pressupostos: [],
      grupos: [],
    });

    /** Avança e deixa as renderizações que o foco espera (aba aberta, seção aberta) acontecerem. */
    async function tentarAvancar(
      fixture: { detectChanges(): void },
      page: { nextOrPublish(): Promise<void> },
    ) {
      await page.nextOrPublish();
      fixture.detectChanges();
      for (let volta = 0; volta < 4; volta++) {
        await new Promise((resolve) => setTimeout(resolve));
        TestBed.inject(ApplicationRef).tick();
      }
    }

    async function avancarDoFormulario(outraAba: boolean) {
      const { fixture, page, store } = montarPagina();
      const invalido = conteudoComLimiteInvalido() as never;
      const valido = { ...conteudoComLimiteInvalido(), itens: [] } as never;
      store.patchObjectSection('formulario', {
        conteudo: outraAba ? valido : invalido,
        outrasFinalidades: outraAba
          ? [
              {
                finalidade: 'HABILITACAO',
                faseCodigo: '',
                conteudo: invalido,
                modeloOrigemCodigo: null,
              },
            ]
          : [],
      });
      store.goTo(ROTULOS_DOS_PASSOS.indexOf('Formulários'));
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      const campo = (): HTMLInputElement | null =>
        raiz.querySelector<HTMLInputElement>('input[aria-invalid="true"]');
      await tentarAvancar(fixture, page);
      return { fixture, page, raiz, campo };
    }

    it('abre a seção recolhida e leva o foco ao limite inválido ao avançar', async () => {
      const { fixture, page, raiz, campo } = await avancarDoFormulario(false);
      for (const botao of raiz.querySelectorAll<HTMLButtonElement>('.editor-formulario__alternar'))
        botao.click();
      fixture.detectChanges();
      expect(campo()?.closest('[hidden]')).not.toBeNull();

      await tentarAvancar(fixture, page);

      expect(campo()?.closest('[hidden]')).toBeNull();
      expect(document.activeElement).toBe(campo());
    });

    it('abre a aba que guarda o limite inválido e leva o foco a ele ao avançar', async () => {
      const { campo } = await avancarDoFormulario(true);

      expect(campo()?.closest('[hidden]')).toBeNull();
      expect(document.activeElement).toBe(campo());
    });
  });

  it('identifica cada pendência pelo passo de origem', async () => {
    const { fixture, page, store } = montarPagina();

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    const erros = store.erroDoPasso() ?? [];
    expect(erros.some((erro) => erro.startsWith('Passo 2 — Identificação'))).toBe(true);
  });

  it('reconcilia o progresso ao validar o rascunho inteiro', async () => {
    const { fixture, page, store } = montarPagina();

    store.syncCompleted([0, 1, 2]);
    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(store.passosConcluidos().has(0)).toBe(false);
    expect(store.passosConcluidos().has(1)).toBe(false);
  });
});
