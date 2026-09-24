import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import {
  SELECAO_BASE_PATH,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { DesempateStepComponent } from './desempate.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000008aa';
const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
const OUTRA_RESOLUCAO = 'Resolução nº 900/2026/Consepe';
const ROTA_PESOS = '/api/configuracao/pesos-area-enem';
const ROTA_AREAS = '/api/configuracao/pesos-area-enem/areas';
const ROTA_DESEMPATE = `/api/selecao/processos-seletivos/${PROCESSO_ID}/criterios-desempate`;
const ROTA_DETALHE = `/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const REGRA_POR_AREA = 'DESEMPATE-MAIOR-NOTA-AREA-ENEM|1';

const ERRO_500 = {
  corpo: { type: 'about:blank', title: 'Erro interno.', status: 500, code: 'x', traceId: 't' },
  opcoes: { status: 500, statusText: 'Internal Server Error' },
};

/**
 * A lista canônica que `GET …/pesos-area-enem/areas` publica — a ordem de qualquer quadro. Não tem
 * a área de um grupo só: o rótulo dela na tela só pode ter vindo do quadro.
 */
const AREAS_CANONICAS = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática' },
];

const TECNOLOGICA = { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' };
const SAUDE = { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' };

function area(codigo: string, rotulo: string) {
  return { codigo, rotulo, peso: 1, corte: null };
}

function linha(resolucao: string, grupo: typeof TECNOLOGICA, areas: unknown[]) {
  return {
    id: `${resolucao}-${grupo.codigo}`,
    resolucao,
    grupoCurso: grupo,
    areas,
    baseLegal: 'Anexo I',
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

/**
 * A Tecnológica tem uma área que a Saúde não tem, e as áreas chegam fora da ordem canônica, para a
 * tela mostrar a ordem da lista canônica.
 */
const PESOS = [
  linha(RESOLUCAO, TECNOLOGICA, [
    area('MATEMATICA', 'Matemática'),
    area('AREA_SO_DE_UM_GRUPO', 'Área de um grupo só'),
    area('REDACAO', 'Redação'),
  ]),
  linha(RESOLUCAO, SAUDE, [area('REDACAO', 'Redação'), area('MATEMATICA', 'Matemática')]),
  linha(OUTRA_RESOLUCAO, TECNOLOGICA, [
    area('MATEMATICA', 'Matemática'),
    area('LINGUAGENS', 'Linguagens'),
  ]),
  linha(OUTRA_RESOLUCAO, SAUDE, [
    area('MATEMATICA', 'Matemática'),
    area('LINGUAGENS', 'Linguagens'),
  ]),
];

/**
 * A cópia que a gravação da classificação congelou: só Linguagens, em todos os grupos — uma área
 * que o cadastro de nenhuma das duas resoluções tem, para a tela só poder tê-la tirado da cópia.
 */
const QUADRO_CONGELADO = [
  { grupoAreaEnem: TECNOLOGICA, baseLegal: 'Anexo I', areas: [area('LINGUAGENS', 'Linguagens')] },
  { grupoAreaEnem: SAUDE, baseLegal: 'Anexo I', areas: [area('LINGUAGENS', 'Linguagens')] },
];

/** Uma cópia com Linguagens e Redação em todos os grupos: Linguagens é comum à outra resolução. */
const COPIA_COM_LINGUAGENS_E_REDACAO = [TECNOLOGICA, SAUDE].map((grupo) => ({
  grupoAreaEnem: grupo,
  baseLegal: 'Anexo I',
  areas: [area('LINGUAGENS', 'Linguagens'), area('REDACAO', 'Redação')],
}));

const CLASSIFICACAO_COM_QUADRO = {
  regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
  regraCalculoVersao: '1.0',
  baseadoEmEnem: true,
  resolucaoPesoAreaEnem: RESOLUCAO,
};

interface Montagem {
  readonly fixture: ComponentFixture<DesempateStepComponent>;
  readonly componente: DesempateStepComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly el: HTMLElement;
}

interface OpcoesDeMontagem {
  /** O rascunho da classificação; `null` deixa o rascunho inicial, sem ENEM. */
  readonly classificacao?: Partial<typeof CLASSIFICACAO_COM_QUADRO> | null;
  readonly antesDeMontar?: (store: ProcessoSeletivoStore) => void;
  /** Deixa sem resposta a leitura do cadastro de Peso por Área. */
  readonly semResponderPesos?: boolean;
  /** Olha as requisições que a montagem fez, antes de respondê-las. */
  readonly antesDeResponder?: (controller: HttpTestingController) => void;
}

let controllerAtual: HttpTestingController | null = null;

async function montar(opcoes: OpcoesDeMontagem = {}): Promise<Montagem> {
  await TestBed.configureTestingModule({
    imports: [DesempateStepComponent],
    providers: [
      ProcessoSeletivoStore,
      CadastroInicialService,
      CatalogosDeClassificacaoService,
      AcompanhamentoDoCadastroDePesos,
      ReleituraDoSnapshot,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  }).compileComponents();

  const store = TestBed.inject(ProcessoSeletivoStore);
  const classificacao =
    opcoes.classificacao === undefined ? CLASSIFICACAO_COM_QUADRO : opcoes.classificacao;
  if (classificacao !== null) store.patchObjectSection('classificacao', classificacao);
  opcoes.antesDeMontar?.(store);

  const fixture = TestBed.createComponent(DesempateStepComponent);
  const controller = TestBed.inject(HttpTestingController);
  controllerAtual = controller;
  fixture.detectChanges();
  opcoes.antesDeResponder?.(controller);
  responderPendentes(controller, { semResponderPesos: opcoes.semResponderPesos });
  fixture.detectChanges();

  return {
    fixture,
    componente: fixture.componentInstance,
    store,
    controller,
    el: fixture.nativeElement as HTMLElement,
  };
}

function responderPendentes(
  controller: HttpTestingController,
  opcoes: { readonly semResponderPesos?: boolean } = {},
): void {
  for (const requisicao of controller.match((r) => !r.url.endsWith(ROTA_PESOS))) {
    requisicao.flush(requisicao.request.url.endsWith(ROTA_AREAS) ? [...AREAS_CANONICAS] : []);
  }
  if (opcoes.semResponderPesos) return;
  for (const requisicao of controller.match((r) => r.url.endsWith(ROTA_PESOS))) {
    requisicao.flush([...PESOS]);
  }
}

/** O processo tem a classificação gravada com `resolucao` e este quadro congelado. */
function classificacaoGravada(
  resolucao: string | null,
  quadro: unknown[],
  status: StatusProcesso = StatusProcesso.rascunho,
) {
  return (store: ProcessoSeletivoStore) => {
    const classificacao = { resolucaoPesoAreaEnem: resolucao, quadroPesoAreaEnem: quadro };
    store.remoteSnapshot.set({ status, classificacao } as unknown as ProcessoSeletivoDto);
    store.registrarClassificacaoLida(
      classificacao as unknown as ProcessoSeletivoDto['classificacao'],
    );
  };
}

/** A cópia congelada igual ao quadro que o cadastro tem para a resolução. */
const COPIA_DO_CADASTRO = [TECNOLOGICA, SAUDE].map((grupo) => ({
  grupoAreaEnem: grupo,
  baseLegal: 'Anexo I',
  areas: [area('MATEMATICA', 'Matemática'), area('REDACAO', 'Redação')],
}));

/** O processo já tem a classificação gravada com o quadro: o Desempate grava direto. */
function comQuadroGravado(m: Montagem): void {
  classificacaoGravada(RESOLUCAO, COPIA_DO_CADASTRO)(m.store);
  m.fixture.detectChanges();
  responderPendentes(m.controller);
  m.fixture.detectChanges();
}

function criterio(areas: string[]): CriterioDesempateConfigurado {
  return {
    regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
    regraVersao: '1',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas,
  };
}

function criterioPorArea(m: Montagem): void {
  m.componente.acrescentar();
  m.componente.escolherRegra(m.componente.criterios().length - 1, REGRA_POR_AREA);
  m.fixture.detectChanges();
}

function seletor(m: Montagem, indice: number): HTMLSelectElement | null {
  return m.el.querySelector<HTMLSelectElement>(`#desemp-area-nova-${indice}`);
}

function opcoesDoSeletor(m: Montagem, indice: number): readonly string[] {
  return Array.from(seletor(m, indice)?.options ?? [])
    .slice(1)
    .map((opcao) => opcao.textContent?.trim() ?? '');
}

function botao(m: Montagem, id: string): HTMLButtonElement {
  const elemento = m.el.querySelector<HTMLButtonElement>(`#${id}`);
  if (elemento === null) throw new Error(`botão ${id} ausente`);
  return elemento;
}

/** Escolhe a área no seletor e confirma pelo botão "Acrescentar". */
function acrescentarPelaTela(m: Montagem, indice: number, codigo: string): void {
  const elemento = seletor(m, indice);
  if (elemento === null) throw new Error('seletor de área ausente');
  elemento.value = codigo;
  elemento.dispatchEvent(new Event('change'));
  botao(m, `desemp-area-acrescentar-${indice}`).click();
  m.fixture.detectChanges();
}

function areasNaTela(m: Montagem, indice: number): readonly string[] {
  return Array.from(
    m.el.querySelectorAll(`[aria-labelledby="desemp-areas-rotulo-${indice}"] li`),
  ).map((item) => item.querySelector('.desempate-area__nome')?.textContent?.trim() ?? '');
}

function textoDaTela(m: Montagem): string {
  return m.el.textContent?.replace(/\s+/g, ' ') ?? '';
}

describe('DesempateStepComponent — ordem das áreas do ENEM', () => {
  afterEach(() => {
    // Solta o módulo mesmo quando a conferência falha: senão a falha de um teste vaza para os
    // seguintes.
    const controller = controllerAtual;
    controllerAtual = null;
    try {
      controller?.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  describe('de onde vêm as áreas', () => {
    it('antes de gravada a classificação, oferece as áreas comuns da resolução escolhida, na ordem canônica', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });

    it('depois de gravada a classificação, antes de ler o cadastro, as áreas vêm da cópia congelada', async () => {
      const m = await montar({
        antesDeMontar: classificacaoGravada(RESOLUCAO, QUADRO_CONGELADO),
        semResponderPesos: true,
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Linguagens']);
      // A leitura do cadastro fica sem resposta: aqui só importa a cópia.
      m.controller.match((r) => r.url.endsWith(ROTA_PESOS)).forEach((r) => r.flush([]));
    });

    it('com a mesma resolução mudada no cadastro, oferece só as áreas que a cópia e o cadastro aceitam', async () => {
      const m = await montar({
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      criterioPorArea(m);

      // A próxima gravação da classificação copia o cadastro, que não tem Linguagens.
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação']);
      expect(textoDaTela(m)).toContain(
        `A resolução ${RESOLUCAO} mudou no cadastro desde a gravação`,
      );
    });

    it('com resoluções sem área em comum, diz isso, e não que falta área comum aos grupos', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: classificacaoGravada(
          RESOLUCAO,
          [TECNOLOGICA, SAUDE].map((grupo) => ({
            grupoAreaEnem: grupo,
            baseLegal: 'Anexo I',
            areas: [area('REDACAO', 'Redação')],
          })),
        ),
      });
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain(
        `A resolução ${RESOLUCAO}, gravada, e a ${OUTRA_RESOLUCAO}, escolhida no passo Fórmula, não têm área em comum a todos os grupos`,
      );
    });

    it('com o rascunho noutra resolução, oferece só as áreas que as duas resoluções aceitam', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Linguagens']);
      expect(textoDaTela(m)).toContain(
        `Só as áreas que a resolução ${RESOLUCAO}, gravada, e a ${OUTRA_RESOLUCAO}, escolhida no passo Fórmula, têm em todos os grupos podem desempatar`,
      );

      // Redação vale na gravada, mas a próxima gravação da classificação a recusaria.
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);
      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Redação não é comum a todos os grupos da resolução de Peso por Área.',
        ],
      });
    });

    it('com o rascunho sem a resolução escolhida, fica na gravada e diz que a mudança espera a Eliminação', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Linguagens']);
      expect(textoDaTela(m)).toContain(
        `As áreas vêm da resolução ${RESOLUCAO}, a da classificação gravada. O que mudou no passo Fórmula`,
      );
    });

    it('com o rascunho fora do ENEM pela média ponderada, não oferece áreas e recusa o critério, que a Eliminação recusaria', async () => {
      const m = await montar({
        classificacao: null,
        antesDeMontar: (store) => {
          classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO)(store);
          store.patchSection('desempate', [criterio(['REDACAO'])]);
        },
      });
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)).toBeNull();
      // O que já está configurado continua à vista, para ser retirado.
      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a classificação escolhida no passo Fórmula não é baseada no ENEM pela média ponderada, e a gravação dela no passo Eliminação vai recusar o critério por área; troque a regra do critério ou remova-o, ou volte a classificação para o ENEM no passo Fórmula.',
        ],
      });
    });

    it('com a classificação gravada sem ENEM e o rascunho já com ENEM, oferece as áreas do cadastro', async () => {
      const m = await montar({ antesDeMontar: classificacaoGravada(null, []) });
      criterioPorArea(m);

      // A gravação da classificação copia o quadro, e os critérios só são gravados depois dela.
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
      expect(textoDaTela(m)).toContain('serão gravados junto com a classificação');
    });

    it('com a classificação gravada sem ENEM e o rascunho com ENEM ainda sem resolução, pede a resolução', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
        antesDeMontar: classificacaoGravada(null, []),
      });
      criterioPorArea(m);

      expect(textoDaTela(m)).toContain('Escolha a resolução de Peso por Área no passo Fórmula');
    });

    it('só para consulta e sem cópia gravada, lê o cadastro em vez de esperar para sempre', async () => {
      const m = await montar({
        antesDeMontar: (store) => {
          store.patchSection('desempate', [criterio(['REDACAO'])]);
          store.remoteSnapshot.set({
            status: StatusProcesso.publicado,
          } as unknown as ProcessoSeletivoDto);
        },
      });

      expect(textoDaTela(m)).not.toContain('Carregando as áreas');
      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
    });

    it('uma tecla em outro passo não recalcula o quadro', async () => {
      const m = await montar();
      const antes = m.componente.situacaoDoQuadro();

      m.store.patchObjectSection('identificacao', { nome: 'Processo de teste' });

      expect(m.componente.situacaoDoQuadro()).toBe(antes);
    });

    describe('com a classificação gravada desconhecida', () => {
      async function montarDesconhecida(): Promise<Montagem> {
        const m = await montar({
          antesDeMontar: (store) => {
            store.processoSeletivoId.set(PROCESSO_ID);
            store.patchSection('desempate', [criterio(['REDACAO'])]);
            classificacaoGravada(RESOLUCAO, QUADRO_CONGELADO)(store);
            store.marcarClassificacaoDesconhecida();
          },
        });
        return m;
      }

      it('não oferece áreas nem as julga, e pede a releitura do processo', async () => {
        const m = await montarDesconhecida();

        expect(seletor(m, 0)).toBeNull();
        expect(m.el.querySelector('#desemp-reler-processo')).not.toBeNull();
        expect(m.componente.validate()).toEqual({
          valid: false,
          messages: [
            'Critério de desempate 1: não se sabe o que a classificação gravada tem agora, porque a última gravação ficou sem resposta ou a releitura do processo falhou, e as áreas que o desempate pode citar dependem disso; releia o processo pelo aviso no início do passo.',
          ],
        });
      });

      it('relido o processo, volta a oferecer as áreas do que ele tem e leva o foco ao critério', async () => {
        const m = await montarDesconhecida();

        const releitura = m.componente.relerProcesso();
        m.controller
          .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
          .flush({
            id: PROCESSO_ID,
            status: StatusProcesso.rascunho,
            classificacao: {
              resolucaoPesoAreaEnem: RESOLUCAO,
              quadroPesoAreaEnem: QUADRO_CONGELADO,
            },
            criteriosDesempate: [],
          });
        await releitura;
        responderPendentes(m.controller);
        m.fixture.detectChanges();
        await m.fixture.whenStable();

        expect(m.el.querySelector('#desemp-reler-processo')).toBeNull();
        expect(opcoesDoSeletor(m, 0)).toEqual(['Linguagens']);
        expect(document.activeElement?.id).toBe('desemp-area-nova-0');
        // A leitura nova da classificação também relê o cadastro, que aqui não importa.
        responderPendentes(m.controller);
      });

      it('uma releitura superada não é anunciada como falha', async () => {
        const m = await montarDesconhecida();
        // Sem processo, a releitura não chega a decidir nada.
        m.store.processoSeletivoId.set(null);

        await m.componente.relerProcesso();

        expect(m.componente.anuncio()).toBe('');
      });

      it('se a releitura falha, o aviso fica e a falha é anunciada', async () => {
        const m = await montarDesconhecida();

        const releitura = m.componente.relerProcesso();
        m.controller
          .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
          .flush(ERRO_500.corpo, ERRO_500.opcoes);
        await releitura;
        m.fixture.detectChanges();

        expect(m.el.querySelector('#desemp-reler-processo')).not.toBeNull();
        expect(m.componente.anuncio()).toBe('Não foi possível reler o processo. Tente novamente.');
      });
    });

    describe('com a cópia gravada por confirmar', () => {
      async function montarPorConfirmar(): Promise<Montagem> {
        return montar({
          antesDeMontar: (store) => {
            store.processoSeletivoId.set(PROCESSO_ID);
            store.patchSection('desempate', [criterio(['REDACAO'])]);
            store.registrarClassificacaoGravadaComQuadro(RESOLUCAO, []);
          },
        });
      }

      it('não oferece as áreas da cópia presumida, e pede a releitura para confirmá-la', async () => {
        const m = await montarPorConfirmar();

        expect(seletor(m, 0)).toBeNull();
        expect(m.el.querySelector('#desemp-reler-processo')).not.toBeNull();
        expect(textoDaTela(m)).toContain('ainda não foi confirmado');
        expect(m.componente.validate()).toEqual({
          valid: false,
          messages: [
            'Critério de desempate 1: o quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura, e as áreas que o desempate pode citar dependem disso; releia o processo pelo aviso no início do passo.',
          ],
        });
      });

      it('se a releitura falha, a cópia continua por confirmar e a falha é anunciada', async () => {
        const m = await montarPorConfirmar();

        const releitura = m.componente.relerProcesso();
        m.controller
          .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
          .flush(ERRO_500.corpo, ERRO_500.opcoes);
        await releitura;
        m.fixture.detectChanges();

        expect(m.componente.situacaoDoQuadro()).toEqual({
          tipo: 'por-reler',
          motivo: 'por-confirmar',
        });
        expect(m.componente.anuncio()).toBe('Não foi possível reler o processo. Tente novamente.');
      });
    });

    it('sem área em comum entre a cópia e a resolução escolhida, as áreas citadas saem pelo rótulo da cópia', async () => {
      const copia = [TECNOLOGICA, SAUDE].map((grupo) => ({
        grupoAreaEnem: grupo,
        baseLegal: 'Anexo I',
        areas: [area('AREA_DA_COPIA', 'Área da cópia')],
      }));
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: (store) => {
          store.patchSection('desempate', [criterio(['AREA_DA_COPIA'])]);
          classificacaoGravada(RESOLUCAO, copia)(store);
        },
      });

      expect(m.componente.situacaoDoQuadro().tipo).toBe('resolucoes-sem-area-em-comum');
      expect(areasNaTela(m, 0)).toEqual(['1ª Área da cópia']);
    });

    it('liga ao seletor e à lista a dica que explica de onde vêm as áreas', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      m.store.patchSection('desempate', [criterio(['LINGUAGENS'])]);
      m.fixture.detectChanges();

      const dica = m.el.querySelector('#desemp-areas-dica-0');
      expect(dica?.textContent).toContain('Só as áreas que a resolução');
      expect(seletor(m, 0)?.getAttribute('aria-describedby')).toBe('desemp-areas-dica-0');
      expect(
        m.el
          .querySelector('[aria-labelledby="desemp-areas-rotulo-0"]')
          ?.getAttribute('aria-describedby'),
      ).toBe('desemp-areas-dica-0');
    });

    it('sem ressalva sobre a origem das áreas, não liga dica nenhuma', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(seletor(m, 0)?.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('depois de gravada nesta sessão uma classificação sem ENEM', () => {
    it('com o rascunho já pelo ENEM, oferece as áreas do cadastro, que a próxima gravação copia', async () => {
      const m = await montar({
        antesDeMontar: (store) => store.registrarClassificacaoGravadaSemQuadro(),
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });
  });

  describe('quando não há área a oferecer', () => {
    it('sem classificação por ENEM com média ponderada, explica e recusa, mas mantém as áreas configuradas à vista e retiráveis', async () => {
      const m = await montar({ classificacao: null });
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain(
        'A nota de área do ENEM só desempata quando a classificação é baseada no ENEM pela média ponderada',
      );
      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a nota de área do ENEM só desempata quando a classificação é baseada no ENEM pela média ponderada, com a resolução de Peso por Área escolhida no passo Fórmula.',
        ],
      });

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('sem a resolução escolhida, aponta o passo Fórmula em vez de dizer que as áreas acabaram', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
      });
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain('Escolha a resolução de Peso por Área no passo Fórmula');
      expect(textoDaTela(m)).not.toContain('Todas as áreas do quadro já estão na ordem');
      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: escolha a resolução de Peso por Área no passo Fórmula: as áreas que o desempate pode citar vêm do quadro dela.',
        ],
      });
    });

    it('enquanto o cadastro é lido, diz que está carregando', async () => {
      const m = await montar({ semResponderPesos: true });
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain('Carregando as áreas do cadastro de Peso por Área');

      responderPendentes(m.controller);
      m.fixture.detectChanges();
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });

    it('com a leitura do cadastro falhando, mostra a falha e lê de novo pelo "Tentar novamente"', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(m.el.querySelector('[role="alert"]')?.textContent).toContain(
        'Não foi possível carregar o cadastro de Peso por Área',
      );

      m.store.recusaDaResolucaoPesoAreaEnem.set('Recusa do cadastro anterior.');
      const tentar = botao(m, 'desemp-areas-tentar');
      tentar.focus();
      tentar.click();
      responderPendentes(m.controller);
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
      expect(document.activeElement?.id).toBe('desemp-area-nova-0');
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('"Tentar novamente" mantém o alerta, com o botão focado, enquanto a nova leitura corre e se ela falhar de novo', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);

      const tentar = botao(m, 'desemp-areas-tentar');
      tentar.focus();
      tentar.click();
      m.fixture.detectChanges();

      expect(m.el.querySelector('#desemp-areas-tentar')).toBe(tentar);
      expect(document.activeElement).toBe(tentar);

      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      m.fixture.detectChanges();

      expect(m.el.querySelector('#desemp-areas-tentar')).toBe(tentar);
      expect(document.activeElement).toBe(tentar);
      expect(m.el.querySelector('[role="alert"]')?.textContent).toContain('2ª tentativa');
    });

    it('com dois critérios por área, avisa a falha uma vez só no passo', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);
      criterioPorArea(m);

      expect(m.el.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(m.el.querySelectorAll('#desemp-areas-tentar')).toHaveLength(1);
      // Cada critério aponta para o aviso, sem repeti-lo.
      expect(m.el.querySelector('#desemp-areas-dica-1')?.textContent).toContain(
        'Veja o aviso no início do passo',
      );
    });

    it('pede a lista canônica das áreas uma vez só, mesmo quando dois motivos a pedem', async () => {
      let pedidosDaLista = 0;
      await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
        antesDeMontar: (store) => store.patchSection('desempate', [criterio(['REDACAO'])]),
        antesDeResponder: (controller) => {
          pedidosDaLista = controller.match((r) => r.url.endsWith(ROTA_AREAS)).length;
        },
      });

      expect(pedidosDaLista).toBe(1);
    });

    it('só diz que todas as áreas estão na ordem quando elas estão', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      expect(seletor(m, 0)?.disabled).toBe(true);
      expect(seletor(m, 0)?.options[0].textContent?.trim()).toBe(
        'Todas as áreas do quadro já estão na ordem',
      );
    });

    it('com as áreas que faltam num critério citadas por outros, diz isso, e não que todas estão nele', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      criterioPorArea(m);
      acrescentarPelaTela(m, 1, 'MATEMATICA');

      expect(seletor(m, 0)?.options[0].textContent?.trim()).toBe(
        'As demais áreas do quadro já estão em outros critérios',
      );
      expect(seletor(m, 1)?.options[0].textContent?.trim()).toBe(
        'As demais áreas do quadro já estão em outros critérios',
      );
    });

    it('com a leitura do cadastro em falha, as áreas citadas ainda saem pelo nome', async () => {
      const m = await montar({
        semResponderPesos: true,
        antesDeMontar: (store) => store.patchSection('desempate', [criterio(['REDACAO'])]),
      });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
    });

    it('a lista canônica que falhou é pedida de novo na leitura seguinte da classificação', async () => {
      const m = await montar({
        classificacao: null,
        antesDeMontar: (store) => store.patchSection('desempate', [criterio(['REDACAO'])]),
        antesDeResponder: (controller) => {
          controller
            .expectOne((r) => r.url.endsWith(ROTA_AREAS))
            .flush(ERRO_500.corpo, ERRO_500.opcoes);
        },
      });
      expect(areasNaTela(m, 0)).toEqual(['1ª REDACAO']);

      classificacaoGravada(null, [])(m.store);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
    });
  });

  describe('montagem da ordem', () => {
    it('sem o quadro gravado, deixa os critérios por área para depois da classificação, e os grava quando pedido', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');

      expect(textoDaTela(m)).toContain('serão gravados junto com a classificação');
      expect(m.componente.confirmacaoDeGravacao()?.aviso).toContain(
        'gravados junto com a classificação',
      );
      await expect(m.componente.persistir()).resolves.toEqual({ valid: true });
      m.controller.expectNone((r) => r.url.endsWith(ROTA_DESEMPATE));
      expect(m.store.desempatePendenteDeGravacao()).toBe(true);

      comQuadroGravado(m);
      const gravacao = m.componente.gravarPendente();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(m.store.desempatePendenteDeGravacao()).toBe(false);
      expect(m.store.criteriosDesempateGravados()?.[0].areas).toEqual(['REDACAO']);
    });

    it('sem critério pendente, gravar o pendente não vai à rede', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);

      await expect(m.componente.gravarPendente()).resolves.toEqual({ valid: true });
      m.controller.expectNone((r) => r.url.endsWith(ROTA_DESEMPATE));
    });

    it('monta a ordem pelo seletor e pelo botão, mostra os rótulos e grava os códigos', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      criterioPorArea(m);

      acrescentarPelaTela(m, 0, 'MATEMATICA');
      acrescentarPelaTela(m, 0, 'REDACAO');

      expect(areasNaTela(m, 0)).toEqual(['1ª Matemática', '2ª Redação']);
      expect(m.componente.anuncio()).toBe('Área Redação acrescentada ao critério 1, na posição 2.');

      const gravacao = m.componente.persistir();
      const pedido = m.controller.expectOne((r) => r.url.endsWith(ROTA_DESEMPATE));
      expect(JSON.stringify(pedido.request.body)).toContain('"areas":["MATEMATICA","REDACAO"]');
      pedido.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(m.store.criteriosDesempateGravados()?.[0].areas).toEqual(['MATEMATICA', 'REDACAO']);
    });

    it('percorrer o seletor pelo teclado não acrescenta nada: só o botão acrescenta', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');

      for (const codigo of ['REDACAO', 'MATEMATICA']) {
        elemento.value = codigo;
        elemento.dispatchEvent(new Event('change'));
        m.fixture.detectChanges();
      }

      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('a escolha ainda não incluída fica com o critério, e não passa a outro ao remover critérios', async () => {
      const m = await montar();
      criterioPorArea(m);
      criterioPorArea(m);
      const primeiro = seletor(m, 0);
      if (primeiro === null) throw new Error('seletor de área ausente');
      primeiro.value = 'MATEMATICA';
      primeiro.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      m.componente.remover(0);
      m.fixture.detectChanges();
      botao(m, 'desemp-area-acrescentar-0').click();
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('ao mover critérios, cada seletor mostra a escolha do seu critério', async () => {
      const m = await montar();
      criterioPorArea(m);
      criterioPorArea(m);
      const primeiro = seletor(m, 0);
      if (primeiro === null) throw new Error('seletor de área ausente');
      primeiro.value = 'MATEMATICA';
      primeiro.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      m.componente.mover(0, 1);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
      expect(seletor(m, 1)?.value).toBe('MATEMATICA');
    });

    it('a escolha cuja área sai do seletor cai, e não volta escolhida com a área', async () => {
      const m = await montar();
      criterioPorArea(m);
      criterioPorArea(m);
      const segundo = seletor(m, 1);
      if (segundo === null) throw new Error('seletor de área ausente');
      segundo.value = 'MATEMATICA';
      segundo.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      acrescentarPelaTela(m, 0, 'MATEMATICA');
      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      botao(m, 'desemp-area-acrescentar-1').click();
      m.fixture.detectChanges();

      expect(seletor(m, 1)?.value).toBe('');
      expect(m.componente.criterios()[1].areas).toEqual([]);
    });

    it('o botão sem área escolhida não acrescenta e pede a escolha', async () => {
      const m = await montar();
      criterioPorArea(m);

      botao(m, 'desemp-area-acrescentar-0').click();
      m.fixture.detectChanges();

      expect(m.componente.criterios()[0].areas).toEqual([]);
      expect(m.componente.anuncio()).toBe('Escolha no seletor a área a acrescentar.');
    });

    it('não oferece de novo a área já citada, nem em outro critério por área', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Matemática']);
      expect(opcoesDoSeletor(m, 1)).toEqual(['Matemática']);
    });

    it('reordena e retira as áreas pelos botões, anunciando cada mudança', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      const subir = botao(m, 'desemp-area-subir-0-1');
      expect(subir.getAttribute('aria-label')).toBe('Mover a área Matemática para cima');
      subir.click();
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Matemática', '2ª Redação']);
      expect(m.componente.anuncio()).toBe(
        'Área Matemática movida para a posição 1 de 2 no critério 1.',
      );

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
      expect(m.componente.anuncio()).toBe('Área Matemática retirada do critério 1.');
    });

    it('trocar de regra limpa as áreas do critério', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');

      m.componente.escolherRegra(0, 'DESEMPATE-MAIOR-IDADE|1.0');

      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('a confirmação lista as áreas pelo rótulo', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'MATEMATICA');
      acrescentarPelaTela(m, 0, 'REDACAO');

      expect(m.componente.confirmacaoDeGravacao()?.itens).toEqual([
        { rotulo: '1º critério', valor: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM: Matemática, Redação' },
      ]);
    });

    it('o mesmo anúncio seguido diz qual vez é, para o leitor de tela anunciar de novo', async () => {
      const m = await montar();
      criterioPorArea(m);

      botao(m, 'desemp-area-acrescentar-0').click();
      botao(m, 'desemp-area-acrescentar-0').click();

      expect(m.componente.anuncio()).toBe('Escolha no seletor a área a acrescentar. (2ª vez)');
    });

    it('a escolha pendente sobrevive a mexer nas áreas do próprio critério', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      m.componente.removerArea(0, 0);
      m.fixture.detectChanges();
      botao(m, 'desemp-area-acrescentar-0').click();

      expect(m.componente.criterios()[0].areas).toEqual(['MATEMATICA']);
    });

    it('a escolha pendente sobrevive ao cadastro relido, enquanto ele carrega', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      // A classificação relida com um quadro novo relê o cadastro; enquanto ele carrega, a cópia
      // decide as áreas.
      const copia = [TECNOLOGICA, SAUDE].map((grupo) => ({
        grupoAreaEnem: grupo,
        baseLegal: 'Anexo I',
        areas: [area('MATEMATICA', 'Matemática'), area('REDACAO', 'Redação')],
      }));
      classificacaoGravada(RESOLUCAO, copia)(m.store);
      m.fixture.detectChanges();
      expect(TestBed.inject(AcompanhamentoDoCadastroDePesos).leitura().lido).toBe(false);
      expect(seletor(m, 0)?.value).toBe('MATEMATICA');
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('MATEMATICA');
    });

    it('o botão de acrescentar usa uma variante de botão do design system', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(botao(m, 'desemp-area-acrescentar-0').classList).toContain('btn--secondary');
    });

    it('a escolha pendente não sobrevive à troca de processo', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      // Outro processo, com um critério por área na mesma posição.
      m.store.reset();
      m.store.patchObjectSection('classificacao', CLASSIFICACAO_COM_QUADRO);
      m.store.patchSection('desempate', [criterio([])]);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
    });

    it('a escolha pendente cai quando a lista de critérios chega de fora, no mesmo processo', async () => {
      const m = await montar();
      criterioPorArea(m);
      const elemento = seletor(m, 0);
      if (elemento === null) throw new Error('seletor de área ausente');
      elemento.value = 'MATEMATICA';
      elemento.dispatchEvent(new Event('change'));
      m.fixture.detectChanges();

      // Uma releitura, ou a hidratação, põe outra lista no rascunho.
      m.store.patchSection('desempate', [criterio([])]);
      m.fixture.detectChanges();

      expect(seletor(m, 0)?.value).toBe('');
    });
  });

  describe('foco', () => {
    it('acompanha a área movida', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      botao(m, 'desemp-area-subir-0-1').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      // No topo, "para cima" fica indisponível: o foco vai para "para baixo" da mesma área.
      expect(document.activeElement?.id).toBe('desemp-area-descer-0-0');
    });

    it('retirada a primeira área, vai para a que passou a ocupar a posição dela', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-remover-0-0');
      expect(areasNaTela(m, 0)).toEqual(['1ª Matemática']);
    });

    it('retirada uma área depois da primeira, vai para a anterior', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      botao(m, 'desemp-area-remover-0-1').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-remover-0-0');
    });

    it('retirada a última área, vai para o seletor', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-nova-0');
    });

    it('retirada a última área sem o seletor na tela, vai para a regra do critério', async () => {
      const m = await montar({ classificacao: null });
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-regra-0');
    });

    it('acrescentada a última área oferecida, vai para a área que acabou de entrar', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-remover-0-1');
    });

    it('depois de "Tentar novamente" sem critério por área, o foco vai para acrescentar critério', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);
      const tentar = botao(m, 'desemp-areas-tentar');
      tentar.focus();
      tentar.click();

      m.componente.escolherRegra(0, 'DESEMPATE-MAIOR-IDADE|1.0');
      responderPendentes(m.controller);
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desempate-acrescentar');
    });
  });

  describe('validação', () => {
    it('recusa o critério por área sem nenhuma área', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: ['Critério de desempate 1: acrescente ao menos uma área do ENEM.'],
      });
    });

    it('recusa área que não é comum a todos os grupos, nomeada pelo rótulo na lista e na recusa', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [criterio(['AREA_SO_DE_UM_GRUPO'])]);
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Área de um grupo só']);
      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Área de um grupo só não é comum a todos os grupos da resolução de Peso por Área.',
        ],
      });
    });

    it('com o quadro sem nenhuma área comum a todos os grupos, diz que nenhuma área desempata', async () => {
      const m = await montar({
        antesDeMontar: classificacaoGravada(RESOLUCAO, [
          { grupoAreaEnem: TECNOLOGICA, baseLegal: 'Anexo I', areas: [area('REDACAO', 'Redação')] },
          { grupoAreaEnem: SAUDE, baseLegal: 'Anexo I', areas: [area('MATEMATICA', 'Matemática')] },
        ]),
      });
      m.store.patchSection('desempate', [criterio(['MATEMATICA'])]);
      m.fixture.detectChanges();

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain('Nenhuma área do ENEM está em todos os grupos');
      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: nenhuma área do ENEM está em todos os grupos do quadro de Peso por Área, e só uma área comum a todos desempata; troque a regra do critério ou escolha outra resolução no passo Fórmula.',
        ],
      });
    });

    it('com a classificação gravada sem grupo no quadro, trata como gravada sem quadro', async () => {
      const m = await montar({ antesDeMontar: classificacaoGravada(RESOLUCAO, []) });
      criterioPorArea(m);

      expect(m.store.classificacaoGravada()).toEqual({ estado: 'sem-quadro' });
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });

    it('recusa a área repetida no mesmo critério que veio gravada', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [criterio(['REDACAO', 'MATEMATICA', 'REDACAO'])]);

      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Redação aparece mais de uma vez na ordem de desempate.',
        ],
      });
    });

    it('recusa a área repetida entre critérios que veio gravada, no critério que a repete', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [
        criterio(['REDACAO']),
        criterio(['MATEMATICA', 'REDACAO']),
      ]);

      expect(m.componente.validate()).toEqual({
        valid: false,
        messages: ['Critério de desempate 2: a área Redação já é citada pelo critério 1.'],
      });
    });
  });

  it('só para consulta, mostra as áreas gravadas pelo rótulo da cópia, sem ler o cadastro nem deixar editar', async () => {
    const m = await montar({
      antesDeMontar: (store) => {
        store.patchSection('desempate', [criterio(['LINGUAGENS'])]);
        // Com Matemática ainda por citar, só o modo consulta trava o seletor e o botão.
        classificacaoGravada(
          RESOLUCAO,
          QUADRO_CONGELADO.map((grupo) => ({
            ...grupo,
            areas: [...grupo.areas, area('MATEMATICA', 'Matemática')],
          })),
          StatusProcesso.publicado,
        )(store);
      },
      // Uma leitura do cadastro sairia sem resposta, e a conferência do fim do teste a acusaria.
      semResponderPesos: true,
    });

    expect(areasNaTela(m, 0)).toEqual(['1ª Linguagens']);
    expect(opcoesDoSeletor(m, 0)).toEqual(['Matemática']);
    expect(botao(m, 'desemp-area-remover-0-0').disabled).toBe(true);
    expect(seletor(m, 0)?.disabled).toBe(true);
    expect(botao(m, 'desemp-area-acrescentar-0').disabled).toBe(true);
  });

  describe('gravação e recusas do servidor', () => {
    const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
    const CITADA_POR_OUTRO =
      'uniplus.selecao.processo_seletivo.area_enem_citada_por_outro_criterio';

    const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';

    async function gravarComRecusa(
      m: Montagem,
      codigo: string,
      errors: readonly { field: string; code: string; message: string }[],
    ) {
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(
          {
            type: 'about:blank',
            title: 'Título genérico da raiz.',
            status: 422,
            code: codigo,
            traceId: 't',
            errors,
          },
          {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
      return gravacao;
    }

    it('sem resposta conclusiva da gravação, o desempate gravado fica desconhecido até a releitura', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await new Promise((resolve) => setTimeout(resolve));

      expect(m.store.criteriosDesempateGravados()).toBeNull();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
        .flush({
          id: PROCESSO_ID,
          classificacao: null,
          criteriosDesempate: [
            {
              ordem: 1,
              regra: { codigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM', versao: '1' },
              areas: ['REDACAO'],
            },
          ],
        });
      await gravacao;

      expect(m.store.criteriosDesempateGravados()).toEqual([criterio(['REDACAO'])]);
    });

    it('explica a área fora do quadro que o servidor recusa, com o critério e a área', async () => {
      const m = await montar();
      // A tela não vê problema; o servidor, com o que ele tem gravado, vê.
      m.store.patchSection('desempate', [criterio(['REDACAO']), criterio(['MATEMATICA'])]);

      const resultado = await gravarComRecusa(m, FORA_DO_QUADRO, [
        { field: 'criterios[1].areas[0]', code: FORA_DO_QUADRO, message: 'x' },
        { field: 'criterios[0].areas[0]', code: CITADA_POR_OUTRO, message: 'x' },
      ]);

      expect(resultado).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 2: a área Matemática não é comum a todos os grupos da resolução de Peso por Área.',
          'Critério de desempate 1: a área Redação já é citada por outro critério de desempate.',
        ],
      });
    });

    it('explica a falta de quadro que o servidor recusa, e mantém o título para o que não explica', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);

      const resultado = await gravarComRecusa(m, SEM_QUADRO, [
        { field: 'criterios[0].regraCodigo', code: SEM_QUADRO, message: 'x' },
        { field: 'criterios[0].regraVersao', code: 'outro', message: 'x' },
      ]);

      expect(resultado).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a classificação gravada não tem o quadro de Peso por Área; escolha a resolução no passo Fórmula, se ainda não escolheu, e grave a classificação no passo Eliminação.',
          'Título genérico da raiz.',
        ],
      });
    });

    it('uma releitura do processo anterior à gravação não desfaz os critérios gravados', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = m.controller.expectOne((r) =>
        r.url.endsWith(`/api/selecao/processos-seletivos/${PROCESSO_ID}`),
      );
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
      leituraAntiga.flush({ id: PROCESSO_ID, classificacao: null, criteriosDesempate: [] });
      await antiga;

      expect(m.store.criteriosDesempateGravados()?.[0].areas).toEqual(['REDACAO']);
    });

    it('com a classificação desconhecida, relê o processo depois de gravar, já que descartou a releitura em curso', async () => {
      const m = await montar({
        antesDeMontar: (store) => {
          store.processoSeletivoId.set(PROCESSO_ID);
          store.marcarClassificacaoDesconhecida();
        },
      });
      m.store.patchSection('desempate', [
        { ...criterio([]), regraCodigo: 'DESEMPATE-MAIOR-IDADE' },
      ]);

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(null, { status: 204, statusText: 'No Content' });
      await new Promise((resolve) => setTimeout(resolve));

      m.controller
        .expectOne((r) => r.url.endsWith(`/api/selecao/processos-seletivos/${PROCESSO_ID}`))
        .flush({ id: PROCESSO_ID, classificacao: null, criteriosDesempate: [] });
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(m.store.motivoDaReleituraDaClassificacao()).not.toBe('desconhecida');
    });

    it('explica as recusas do servidor às áreas de um critério, nomeando o critério e a área', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      m.store.patchSection('desempate', [criterio(['REDACAO']), criterio(['MATEMATICA'])]);
      const PREFIXO = 'uniplus.selecao.criterio_desempate.';

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(
          {
            type: 'about:blank',
            title: 'Título genérico da raiz.',
            status: 422,
            code: `${PREFIXO}area_repetida`,
            traceId: 't',
            errors: [
              { field: 'criterios[0].areas[0]', code: `${PREFIXO}area_repetida`, message: 'x' },
              { field: 'criterios[1].areas[0]', code: `${PREFIXO}area_invalida`, message: 'x' },
              { field: 'criterios[1].areas', code: `${PREFIXO}areas_obrigatorias`, message: 'x' },
              { field: 'criterios[0].areas', code: `${PREFIXO}areas_em_excesso`, message: 'x' },
            ],
          },
          {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/problem+json' },
          },
        );

      await expect(gravacao).resolves.toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Redação aparece mais de uma vez na ordem de desempate.',
          'Critério de desempate 2: a área Matemática não é uma área do ENEM.',
          'Critério de desempate 2: acrescente ao menos uma área do ENEM.',
          'Critério de desempate 1: o critério cita mais áreas do que o desempate admite.',
        ],
      });
    });
  });
});
