import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import {
  CRITERIO_POR_AREA,
  configurarPagina,
  montarPagina,
} from './processo-seletivo.page.testing';
import { CadastroInicial } from './wizard/shared/cadastro-inicial.service';
import { quadroCongelado } from './wizard/shared/quadro-de-pesos';
import { ReleituraDoSnapshot } from './wizard/shared/releitura-do-snapshot.service';
import type { PassoDoWizard } from './wizard/passo-do-wizard';
import { DesempatePassoComponent } from './wizard/passos/desempate/desempate.component';
import { ROTULOS_DOS_PASSOS } from './wizard/processo-seletivo.data';
import type { ProcessoSeletivoStore } from './wizard/processo-seletivo.store';

describe('ProcessoSeletivoPage — publicação: critérios de desempate por área', () => {
  beforeEach(configurarPagina);

  describe('critérios de desempate por área antes da classificação com quadro', () => {
    const INDICE_DO_DESEMPATE = ROTULOS_DOS_PASSOS.indexOf('Desempate');
    const INDICE_DA_ELIMINACAO = ROTULOS_DOS_PASSOS.indexOf('Eliminação');

    const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
    const DETALHE_COM_QUADRO = {
      id: 'processo-1',
      classificacao: {
        resolucaoPesoAreaEnem: RESOLUCAO,
        quadroPesoAreaEnem: [
          {
            grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
          },
        ],
      },
      criteriosDesempate: [],
    } as unknown as ProcessoSeletivoDto;
    const COPIA_PRESUMIDA = quadroCongelado(
      DETALHE_COM_QUADRO.classificacao?.quadroPesoAreaEnem ?? [],
    );

    /**
     * O Desempate adia os critérios, a Eliminação grava a classificação e deixa a cópia por
     * confirmar, e a releitura a confirma — ou falha. A gravação pendente do Desempate é observada,
     * sem ir à rede.
     */
    function montarFluxo(
      recusaDosCriterios: string[] | null = null,
      {
        releituraFalha = false,
        trocaDeProcesso = false,
      }: { readonly releituraFalha?: boolean; readonly trocaDeProcesso?: boolean } = {},
    ) {
      const montagem = montarPagina();
      const { fixture, page, store } = montagem;
      const ordem: string[] = [];
      vi.spyOn(fixture.debugElement.injector.get(ReleituraDoSnapshot), 'reler').mockImplementation(
        async () => {
          ordem.push('releitura');
          if (trocaDeProcesso) store.geracao.update((valor) => valor + 1);
          else if (!releituraFalha) store.registrarGravadoLido(DETALHE_COM_QUADRO);
          return true;
        },
      );
      const passos = (page as unknown as { passos: () => readonly unknown[] }).passos();
      const desempate = passos.find(
        (passo): passo is DesempatePassoComponent => passo instanceof DesempatePassoComponent,
      );
      if (desempate === undefined) throw new Error('passo Desempate ausente');
      vi.spyOn(desempate, 'gravarAposAClassificacao').mockImplementation(async () => {
        ordem.push('critérios');
        if (recusaDosCriterios !== null) return { valid: false, messages: recusaDosCriterios };
        store.classificacao.desempatePendenteDeGravacao.set(false);
        return { valid: true };
      });
      const stubDoDesempate = {
        validar: () => ({ valid: true }),
        persistir: vi.fn(async () => {
          ordem.push('critérios adiados');
          store.classificacao.desempatePendenteDeGravacao.set(true);
          return { valid: true };
        }),
      };
      const stubDaEliminacao = {
        validar: () => ({ valid: true }),
        persistir: vi.fn(async () => {
          ordem.push('classificação');
          store.classificacao.registrarGravadaComQuadro(RESOLUCAO, COPIA_PRESUMIDA);
          return { valid: true };
        }),
      };
      const stubSemPersistir = { validar: () => ({ valid: true }) };
      vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
        (index: number) =>
          index === INDICE_DO_DESEMPATE
            ? stubDoDesempate
            : index === INDICE_DA_ELIMINACAO
              ? stubDaEliminacao
              : stubSemPersistir,
      );
      fixture.detectChanges();
      return { ...montagem, ordem };
    }

    it('avançando do Desempate à Eliminação, grava a classificação e depois os critérios', async () => {
      const { page, store, ordem } = montarFluxo();

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura', 'critérios']);
      expect(store.passoAtual()).toBe(INDICE_DA_ELIMINACAO + 1);
      expect(store.erroDoPasso()).toBeNull();
      expect(store.classificacao.desempatePendenteDeGravacao()).toBe(false);
    });

    it('a recusa dos critérios gravados depois da classificação leva ao passo Desempate', async () => {
      const { page, store, ordem } = montarFluxo(['Critério de desempate 1: recusado.']);

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura', 'critérios']);
      expect(store.passoAtual()).toBe(INDICE_DO_DESEMPATE);
      expect(store.erroDoPasso()).toEqual(['Critério de desempate 1: recusado.']);
    });

    it('na varredura da publicação, a mesma ordem: classificação, depois critérios', async () => {
      const { page, store, ordem } = montarFluxo();

      store.goTo(store.totalDePassos - 1);
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura', 'critérios']);
    });

    it('sem a cópia confirmada pela releitura, não grava os critérios e diz por quê', async () => {
      const { page, store, ordem } = montarFluxo(null, { releituraFalha: true });

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura']);
      expect(store.passoAtual()).toBe(INDICE_DO_DESEMPATE);
      expect(JSON.stringify(store.erroDoPasso())).toContain('não pôde ser confirmado');
    });

    /**
     * A varredura com o Desempate de verdade: `aoGravarAClassificacao` diz o que a Eliminação deixa
     * no store, e `detalhe`, o que a releitura traz.
     */
    async function montarVarreduraReal(
      aoGravarAClassificacao: (store: ProcessoSeletivoStore) => void,
      detalhe: ProcessoSeletivoDto = DETALHE_COM_QUADRO,
    ) {
      // O cadastro de Peso por Área tem a resolução com o quadro que a gravação vai copiar.
      TestBed.overrideProvider(PesosEnemApi, {
        useValue: {
          listar: () =>
            of(
              apiOk(
                [
                  {
                    id: 'g',
                    resolucao: RESOLUCAO,
                    grupoCurso: { codigo: 'G', rotulo: 'Grupo' },
                    areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
                    baseLegal: 'Anexo I',
                    criadoEm: '2026-09-01T00:00:00Z',
                  },
                ],
                200,
                new HttpHeaders(),
              ),
            ),
          listarAreas: () =>
            of(apiOk([{ codigo: 'REDACAO', rotulo: 'Redação' }], 200, new HttpHeaders())),
        },
      });
      const { fixture, page, store } = montarPagina();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      store.processoSeletivoId.set('processo-1');
      store.patchObjectSection('classificacao', {
        regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      store.patchSection('desempate', [CRITERIO_POR_AREA]);
      fixture.detectChanges();
      await fixture.whenStable();

      const ordem: string[] = [];
      const cadastro = fixture.debugElement.injector.get(CadastroInicial);
      vi.spyOn(cadastro, 'obterDetalhe').mockImplementation(async () => {
        ordem.push('releitura');
        return apiOk(detalhe, 200, new HttpHeaders());
      });
      const gravarCriterios = vi
        .spyOn(cadastro, 'definirCriteriosDesempate')
        .mockImplementation(async () => {
          ordem.push('critérios');
          return { ok: true };
        });
      const passos = (page as unknown as { passos: () => readonly PassoDoWizard[] }).passos();
      const stubDaEliminacao = {
        validar: () => ({ valid: true }),
        persistir: vi.fn(async () => {
          ordem.push('classificação');
          aoGravarAClassificacao(store);
          return { valid: true };
        }),
      };
      const stubSemPersistir = { validar: () => ({ valid: true }) };
      vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
        (index: number) =>
          index === INDICE_DO_DESEMPATE
            ? passos[index]
            : index === INDICE_DA_ELIMINACAO
              ? stubDaEliminacao
              : stubSemPersistir,
      );
      return { page, store, ordem, gravarCriterios };
    }

    it('na varredura, com o Desempate de verdade, confirma a cópia e grava os critérios sem recusa', async () => {
      const { page, store, ordem, gravarCriterios } = await montarVarreduraReal((store) =>
        store.classificacao.registrarGravadaComQuadro(RESOLUCAO, COPIA_PRESUMIDA),
      );

      store.goTo(store.totalDePassos - 1);
      await page.nextOrPublish();

      expect(ordem).toEqual(['classificação', 'releitura', 'critérios']);
      expect(gravarCriterios).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(store.erroDoPasso() ?? null)).not.toContain('Desempate');
      expect(store.classificacao.desempatePendenteDeGravacao()).toBe(false);
    });

    it('trocado o processo durante a releitura, não grava os critérios nem acusa nada', async () => {
      const { page, store, ordem } = montarFluxo(null, { trocaDeProcesso: true });

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura']);
      expect(store.erroDoPasso()).toBeNull();
    });

    it('na varredura, com a classificação desconhecida depois de gravar, relê e grava os critérios', async () => {
      const { page, store, ordem, gravarCriterios } = await montarVarreduraReal((store) =>
        store.classificacao.marcarDesconhecida(),
      );

      store.goTo(store.totalDePassos - 1);
      await page.nextOrPublish();

      expect(ordem).toEqual(['classificação', 'releitura', 'critérios']);
      expect(gravarCriterios).toHaveBeenCalledTimes(1);
      expect(store.classificacao.desempatePendenteDeGravacao()).toBe(false);
      expect(JSON.stringify(store.erroDoPasso() ?? null)).not.toContain('Desempate');
    });

    it('com os critérios ainda pendentes ao fim da varredura, a publicação é barrada no Desempate', async () => {
      const { page, store, gravarCriterios } = await montarVarreduraReal(
        (store) => store.classificacao.marcarDesconhecida(),
        {
          id: 'processo-1',
          classificacao: null,
          criteriosDesempate: [],
        } as unknown as ProcessoSeletivoDto,
      );

      store.goTo(store.totalDePassos - 1);
      await page.nextOrPublish();

      expect(gravarCriterios).not.toHaveBeenCalled();
      expect(JSON.stringify(store.erroDoPasso())).toContain(
        `Passo ${INDICE_DO_DESEMPATE + 1} — Desempate: Os critérios de desempate por área não foram gravados`,
      );
    });

    it('na varredura, a recusa dos critérios é dita no passo Desempate', async () => {
      const { page, store } = montarFluxo(['recusado.']);

      store.goTo(store.totalDePassos - 1);
      await page.nextOrPublish();

      expect(store.erroDoPasso()).toContain(
        `Passo ${INDICE_DO_DESEMPATE + 1} — Desempate: recusado.`,
      );
    });
  });
});
