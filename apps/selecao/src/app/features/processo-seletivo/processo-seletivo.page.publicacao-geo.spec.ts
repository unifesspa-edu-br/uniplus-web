import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { configurarPagina, montarPagina } from './processo-seletivo.page.testing';
import { MENSAGEM_GEO_INDISPONIVEL } from './wizard/shared/geo-indisponivel';

type PaginaMontada = ReturnType<typeof montarPagina>;

describe('ProcessoSeletivoPage — falha do Geo na publicação', () => {
  beforeEach(configurarPagina);

  async function falharPublicacaoPorGeo({ fixture, store }: PaginaMontada): Promise<void> {
    const conducao = fixture.debugElement.injector.get(ConducaoDoWizard);
    store.goTo(store.totalDePassos - 1);
    const revisao = {
      validar: () => ({ valid: true }),
      persistir: vi.fn().mockResolvedValue({ valid: false, messages: [MENSAGEM_GEO_INDISPONIVEL] }),
    };
    await conducao.gravarEAvancar(revisao);
    fixture.detectChanges();
  }

  function botaoPublicar(tela: HTMLElement): HTMLButtonElement | undefined {
    return Array.from(tela.querySelectorAll('button')).find(
      (elemento) => elemento.textContent?.trim() === 'Publicar',
    );
  }

  it('mostra a mensagem e mantém o botão de publicar disponível', async () => {
    const pagina = montarPagina();
    await falharPublicacaoPorGeo(pagina);

    const tela: HTMLElement = pagina.fixture.nativeElement;
    const botao = botaoPublicar(tela);
    expect(tela.textContent).toContain(MENSAGEM_GEO_INDISPONIVEL);
    expect(botao).toBeDefined();
    expect(botao?.disabled).toBe(false);
  });
});
