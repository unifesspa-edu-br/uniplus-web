import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { PASSOS } from './wizard/processo-seletivo.data';
import { configurarPagina, montarPagina } from './processo-seletivo.page.testing';
import { CadastroInicial } from './wizard/shared/cadastro-inicial.service';

const PASSO_FORMULA = PASSOS.findIndex((passo) => passo.rotulo === 'Fórmula e precisão');

describe('ProcessoSeletivoPage — o passo Fórmula e precisão grava ao avançar', () => {
  beforeEach(configurarPagina);
  afterEach(() => TestBed.resetTestingModule());

  function abrirAFormulaPreenchida() {
    const pagina = montarPagina();
    const { fixture, store } = pagina;
    // O processo já criado ganha endereço próprio; a rota dele não está neste teste.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store.processoSeletivoId.set('processo-1');
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
      regraCalculoVersao: '1.0',
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
    });
    store.goTo(PASSO_FORMULA);
    fixture.detectChanges();
    const injetor = fixture.debugElement.injector;
    const definirClassificacao = vi
      .spyOn(injetor.get(CadastroInicial), 'definirClassificacao')
      .mockResolvedValue({ ok: true });
    const gravarDesempate = vi.spyOn(injetor.get(ConducaoDoWizard), 'gravarDesempatePendente');
    return { ...pagina, definirClassificacao, gravarDesempate };
  }

  it('anuncia que o avanço grava, pede a confirmação e só então envia a classificação', async () => {
    const { page, fixture, definirClassificacao } = abrirAFormulaPreenchida();
    expect(page.rotuloDeAvanco()).toBe('Gravar e avançar');

    await page.nextOrPublish();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()?.titulo).toBe('Confirmar a classificação do processo');
    expect(definirClassificacao).not.toHaveBeenCalled();
  });

  it('depois de confirmada, grava a classificação sem regras de eliminação, grava o desempate adiado e avança', async () => {
    const { page, store, definirClassificacao, gravarDesempate } = abrirAFormulaPreenchida();

    await page.nextOrPublish();
    await page.confirmarGravacao();

    expect(definirClassificacao).toHaveBeenCalledTimes(1);
    expect(definirClassificacao.mock.calls[0][1]).toMatchObject({
      regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
      regrasEliminacao: [],
    });
    expect(gravarDesempate.mock.invocationCallOrder[0]).toBeGreaterThan(
      definirClassificacao.mock.invocationCallOrder[0],
    );
    expect(store.passoAtual()).toBe(PASSO_FORMULA + 1);
  });

  it('em processo publicado, o botão é "Próximo" e nada é enviado', async () => {
    const { page, store, fixture, definirClassificacao } = abrirAFormulaPreenchida();
    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as never);
    fixture.detectChanges();

    expect(page.rotuloDeAvanco()).toBe('Próximo');
    await page.nextOrPublish();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(definirClassificacao).not.toHaveBeenCalled();
    expect(store.passoAtual()).toBe(PASSO_FORMULA + 1);
  });
});
