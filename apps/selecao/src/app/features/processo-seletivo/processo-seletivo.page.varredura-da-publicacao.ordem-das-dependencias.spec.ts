import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import {
  CRITERIO_POR_AREA,
  configurarPagina,
  montarPagina,
} from './processo-seletivo.page.testing';
import type { PassoDoWizard } from './wizard/passo-do-wizard';
import { ROTULOS_DOS_PASSOS } from './wizard/processo-seletivo.data';
import { CadastroInicial } from './wizard/shared/cadastro-inicial.service';
import { quadroCongelado } from './wizard/shared/quadro-de-pesos';

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
const QUADRO_GRAVADO = quadroCongelado([
  {
    grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
    baseLegal: 'Anexo I',
    areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
  },
]);

const RECUSA_PELO_CRITERIO_ANTIGO = {
  ok: false as const,
  inconclusiva: false,
  problem: {
    type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.selecao.classificacao.criterio_gravado_sem_area',
    title: 'A classificação deixa sem nota de área um critério de desempate já gravado.',
    status: 422,
    code: 'uniplus.selecao.classificacao.criterio_gravado_sem_area',
    traceId: '',
  },
};
const CRITERIO_SEM_AREA = { ...CRITERIO_POR_AREA, regraCodigo: 'DESEMPATE_MAIOR_IDADE', areas: [] };
const indiceDe = (rotulo: (typeof ROTULOS_DOS_PASSOS)[number]) =>
  ROTULOS_DOS_PASSOS.indexOf(rotulo);
const INDICES_REAIS = [indiceDe('Fórmula e precisão'), indiceDe('Desempate')];
const INDICE_DO_FADA = indiceDe('FADA');

describe('ProcessoSeletivoPage — publicação: gravação na ordem das dependências', () => {
  beforeEach(configurarPagina);
  afterEach(() => TestBed.resetTestingModule());

  /**
   * O servidor tem o desempate por área e a classificação com quadro. O rascunho tira a
   * classificação do ENEM e troca o critério por um que não usa área; os passos reais gravam.
   */
  async function montarProcessoComDesempatePorAreaSalvo() {
    const pagina = montarPagina();
    const { fixture, page, store } = pagina;
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store.processoSeletivoId.set('processo-1');
    store.classificacao.registrarGravadaComQuadro(RESOLUCAO, QUADRO_GRAVADO);
    store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
      regraCalculoVersao: '1.0',
      baseadoEmEnem: false,
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
    });
    store.patchSection('desempate', [CRITERIO_SEM_AREA]);
    fixture.detectChanges();
    await fixture.whenStable();

    const cadastro = fixture.debugElement.injector.get(CadastroInicial);
    const ordem: string[] = [];
    const definirClassificacao = vi
      .spyOn(cadastro, 'definirClassificacao')
      .mockImplementation(async () => {
        ordem.push('classificação');
        return ordem.includes('critérios') ? { ok: true } : RECUSA_PELO_CRITERIO_ANTIGO;
      });
    const definirCriterios = vi
      .spyOn(cadastro, 'definirCriteriosDesempate')
      .mockImplementation(async () => {
        ordem.push('critérios');
        return { ok: true };
      });
    const passos = (page as unknown as { passos: () => readonly PassoDoWizard[] }).passos();
    const stubSemGravar = { validar: () => ({ valid: true }) };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (indice: number) => (INDICES_REAIS.includes(indice) ? passos[indice] : stubSemGravar),
    );
    return { ...pagina, ordem, definirClassificacao, definirCriterios };
  }

  it('grava os critérios antes da classificação e publica sem acusar falha na Fórmula', async () => {
    const { page, store, ordem, definirClassificacao } =
      await montarProcessoComDesempatePorAreaSalvo();

    store.goTo(store.totalDePassos - 1);
    await page.nextOrPublish();

    expect(ordem.slice(0, 2)).toEqual(['critérios', 'classificação']);
    expect(definirClassificacao).toHaveBeenCalled();
    expect(store.erroDoPasso()).toBeNull();
    expect(page.confirmacaoPendente()).toBeNull();
  });

  function passosQueFalham(ordem: string[], falham: readonly string[]) {
    const passo = (nome: string, extra = {}) => ({
      validar: () => ({ valid: true }),
      persistir: async () => {
        ordem.push(nome);
        return falham.includes(nome)
          ? { valid: false, messages: [`Falha em ${nome}.`] }
          : { valid: true };
      },
      ...extra,
    });
    const [formula, desempate] = INDICES_REAIS;
    return {
      [formula]: passo('fórmula', { gravaAClassificacao: true }),
      [INDICE_DO_FADA]: passo('fada'),
      [desempate]: passo('desempate'),
    } as Record<number, PassoDoWizard>;
  }

  async function publicarComPassos(passos: Record<number, PassoDoWizard>) {
    const { fixture, page, store } = montarPagina();
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (indice: number) => passos[indice] ?? ({ validar: () => ({ valid: true }) } as PassoDoWizard),
    );
    store.goTo(store.totalDePassos - 1);
    await page.nextOrPublish();
    return store;
  }

  it('grava os critérios antes dos demais e lista as falhas na ordem dos passos', async () => {
    const ordem: string[] = [];
    const store = await publicarComPassos(passosQueFalham(ordem, ['fórmula', 'fada']));
    const [formula] = INDICES_REAIS;

    expect(ordem).toEqual(['desempate', 'fórmula', 'fada']);
    expect(store.erroDoPasso()).toEqual([
      `Passo ${formula + 1} — Fórmula e precisão: Falha em fórmula.`,
      `Passo ${INDICE_DO_FADA + 1} — FADA: Falha em fada.`,
    ]);
  });

  it('com os critérios recusados, não grava a classificação nem a acusa de falha', async () => {
    const ordem: string[] = [];
    const store = await publicarComPassos(passosQueFalham(ordem, ['desempate']));
    const [, desempate] = INDICES_REAIS;

    expect(ordem).toEqual(['desempate', 'fada']);
    expect(store.erroDoPasso()).toEqual([
      `Passo ${desempate + 1} — Desempate: Falha em desempate.`,
    ]);
  });
});
