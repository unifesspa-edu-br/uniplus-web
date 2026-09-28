import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import {
  ProcessoSeletivoDto,
  RegraCatalogoDto,
  SELECAO_BASE_PATH,
  StatusProcesso,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { BonusStepComponent } from '../bonus/bonus.component';
import { DesempateStepComponent } from '../desempate/desempate.component';
import { EliminacaoStepComponent } from '../eliminacao/eliminacao.component';
import { FormulaStepComponent } from '../formula/formula.component';
import { AcompanhamentoDoCadastroDePesos } from './acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from './catalogos-de-classificacao.service';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-000000000898';

function regra(codigo: string): RegraCatalogoDto {
  return {
    codigo,
    versao: '1.0',
    tipo: 'regra_calculo',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: `Base de ${codigo}`,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

interface Montagem<T> {
  fixture: ComponentFixture<T>;
  host: HTMLElement;
  store: ProcessoSeletivoStore;
  catalogos: CatalogosDeClassificacaoService;
}

async function montar<T>(componente: Type<T>): Promise<Montagem<T>> {
  await TestBed.configureTestingModule({
    imports: [componente],
    providers: [
      ProcessoSeletivoStore,
      CadastroInicialService,
      CatalogosDeClassificacaoService,
      AcompanhamentoDoCadastroDePesos,
      { provide: ReleituraDoSnapshot, useValue: { reler: async () => true } },
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(componente);
  const store = TestBed.inject(ProcessoSeletivoStore);
  const catalogos = TestBed.inject(CatalogosDeClassificacaoService);
  store.processoSeletivoId.set(PROCESSO_ID);
  detectar(fixture);
  return { fixture, host: fixture.nativeElement as HTMLElement, store, catalogos };
}

/** Renderiza e responde vazio a toda leitura de fundo que o passo disparar. */
function detectar(fixture: ComponentFixture<unknown>): void {
  const controller = TestBed.inject(HttpTestingController);
  for (let rodada = 0; rodada < 3; rodada++) {
    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
  }
  fixture.detectChanges();
}

function valorDoSelect(host: HTMLElement, id: string): string | undefined {
  return host.querySelector<HTMLSelectElement>(`#${id}`)?.value;
}

/** O processo publicado: a edição fica bloqueada pelo status lido do servidor. */
function publicar(store: ProcessoSeletivoStore): void {
  store.remoteSnapshot.set({
    id: PROCESSO_ID,
    status: StatusProcesso.publicado,
  } as unknown as ProcessoSeletivoDto);
}

/** O que a consulta lê sob cada rótulo, na ordem da tela. */
function leitura(host: HTMLElement): (readonly [string, string])[] {
  return Array.from(host.querySelectorAll('dl')).map(
    (par) =>
      [
        par.querySelector('dt')?.textContent?.trim() ?? '',
        par.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ] as const,
  );
}

/** Nenhum controle de formulário nem ação: a consulta lê, não edita. */
function semControles(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('input, select, textarea, button, ui-combobox')).map(
    (controle) => controle.id || controle.tagName,
  );
}

function controlesEditaveis(host: HTMLElement, seletor: string): string[] {
  return Array.from(host.querySelectorAll<HTMLInputElement>(seletor))
    .filter((controle) => !controle.disabled)
    .map((controle) => controle.id || controle.textContent?.trim() || controle.tagName);
}

const CLASSIFICACAO_LOCAL = {
  regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
  regraCalculoVersao: '1.0',
  regraArredondamentoCodigo: 'ARRED-TRUNCAR',
  regraArredondamentoVersao: '1.0',
  casasArredondamento: '2',
  regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
  regraOrdemAlocacaoVersao: '1.0',
  nOpcoesAlocacao: '1',
};

describe('regra gravada no select, passo lido como texto em consulta', () => {
  describe('Fórmula', () => {
    it('mostra as regras gravadas quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(FormulaStepComponent);
      store.patchObjectSection('classificacao', CLASSIFICACAO_LOCAL);
      detectar(fixture);

      catalogos.regrasCalculo.set([
        regra('CLASSIFICACAO-IMPORTADA'),
        regra('FORMULA-MEDIA-PONDERADA'),
      ]);
      catalogos.regrasArredondamento.set([regra('ARRED-TRUNCAR')]);
      catalogos.regrasOrdemAlocacao.set([regra('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'f-regra-calculo')).toBe('FORMULA-MEDIA-PONDERADA|1.0');
      expect(valorDoSelect(host, 'f-regra-arredondamento')).toBe('ARRED-TRUNCAR|1.0');
      expect(valorDoSelect(host, 'f-ordem-alocacao')).toBe(
        'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA|1.0',
      );
    });

    it('com o processo publicado, lê as regras gravadas como texto', async () => {
      const { fixture, host, store, catalogos } = await montar(FormulaStepComponent);
      store.patchObjectSection('classificacao', CLASSIFICACAO_LOCAL);
      publicar(store);
      catalogos.regrasCalculo.set([regra('FORMULA-MEDIA-PONDERADA')]);
      catalogos.regrasArredondamento.set([regra('ARRED-TRUNCAR')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Regra de cálculo', 'FORMULA-MEDIA-PONDERADA — Base de FORMULA-MEDIA-PONDERADA'],
        ['Regra de arredondamento', 'ARRED-TRUNCAR — Base de ARRED-TRUNCAR'],
        ['Casas decimais', '2'],
        ['Ordem de alocação', 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA — base legal indisponível'],
        ['Número de opções de curso', '1 opção'],
        ['Classificação baseada em provas e notas do ENEM', 'Não'],
      ]);
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(FormulaStepComponent);
      store.patchObjectSection('classificacao', CLASSIFICACAO_LOCAL);
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
    });
  });

  describe('Bônus', () => {
    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(BonusStepComponent);
      store.patchObjectSection('bonus', {
        ativo: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
      });
      detectar(fixture);

      catalogos.regrasBonus.set([regra('BONUS-OUTRO'), regra('BONUS-REGIONAL')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'f-bonus-regra')).toBe('BONUS-REGIONAL|1.0');
    });

    it('com o processo publicado, lê o bônus gravado como texto', async () => {
      const { fixture, host, store, catalogos } = await montar(BonusStepComponent);
      store.patchObjectSection('bonus', {
        ativo: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
        fator: '1.2',
        teto: '',
      });
      publicar(store);
      catalogos.regrasBonus.set([regra('BONUS-REGIONAL')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Bônus regional', 'Aplicado neste processo'],
        ['Regra do bônus', 'BONUS-REGIONAL — Base de BONUS-REGIONAL'],
        ['Fator', '1,2'],
        ['Teto', 'Sem teto'],
        ['Base Legal do bônus', 'Não informado'],
      ]);
    });

    it('com o processo publicado e sem bônus, diz que ele não se aplica', async () => {
      const { fixture, host, store } = await montar(BonusStepComponent);
      store.patchObjectSection('bonus', { ativo: false });
      publicar(store);
      detectar(fixture);

      expect(leitura(host)).toEqual([['Bônus regional', 'Não aplicado neste processo']]);
      expect(host.querySelector('.bonus-info')).toBeNull();
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(BonusStepComponent);
      store.patchObjectSection('bonus', {
        ativo: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
      });
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
    });
  });

  describe('Desempate', () => {
    const criterio = {
      regraCodigo: 'DESEMPATE-MAIOR-IDADE',
      regraVersao: '1.0',
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      valores: [],
      areas: [],
    };

    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(DesempateStepComponent);
      store.patchSection('desempate', [criterio]);
      detectar(fixture);

      catalogos.criteriosDesempate.set([regra('DESEMPATE-IDOSO'), regra('DESEMPATE-MAIOR-IDADE')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'desemp-regra-0')).toBe('DESEMPATE-MAIOR-IDADE|1.0');
    });

    it('com o processo publicado, lê cada critério como texto, na ordem, sem ações', async () => {
      const { fixture, host, store, catalogos } = await montar(DesempateStepComponent);
      const idoso = { ...criterio, regraCodigo: 'DESEMPATE-IDOSO', idadeMinima: '60' };
      store.patchSection('desempate', [criterio, idoso]);
      publicar(store);
      catalogos.criteriosDesempate.set([regra('DESEMPATE-MAIOR-IDADE'), regra('DESEMPATE-IDOSO')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Regra do critério', 'DESEMPATE-MAIOR-IDADE — Base de DESEMPATE-MAIOR-IDADE'],
        ['Regra do critério', 'DESEMPATE-IDOSO — Base de DESEMPATE-IDOSO'],
        ['Idade mínima', '60'],
      ]);
      expect(Array.from(host.querySelectorAll('.desempate-num'), (num) => num.textContent)).toEqual(
        ['1º', '2º'],
      );
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(DesempateStepComponent);
      store.patchSection('desempate', [criterio, criterio]);
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
      expect(controlesEditaveis(host, '.desempate-btn, #desempate-acrescentar')).toEqual([]);
    });

    it('com o processo publicado, acrescentar, mover e remover pelo código não mudam o rascunho', async () => {
      const { fixture, store } = await montar(DesempateStepComponent);
      const segundo = { ...criterio, regraCodigo: 'DESEMPATE-IDOSO' };
      store.patchSection('desempate', [criterio, segundo]);
      publicar(store);
      detectar(fixture);
      const componente = fixture.componentInstance;

      componente.acrescentar();
      componente.mover(0, 1);
      componente.remover(0);

      expect(store.draft().desempate).toEqual([criterio, segundo]);
    });
  });

  describe('Eliminação', () => {
    const regraGravada = {
      regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
      regraVersao: '1.0',
      etapaRef: '',
      notaMinima: '400',
      minimo: '',
      areaCodigo: '',
    };

    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(EliminacaoStepComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      detectar(fixture);

      catalogos.regrasEliminacao.set([regra('ELIM-ZERO-EM-AREA'), regra('ELIM-NOTA-MINIMA-ETAPA')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'elim-regra-0')).toBe('ELIM-NOTA-MINIMA-ETAPA|1.0');
    });

    it('com o processo publicado, lê cada regra como texto, sem ações', async () => {
      const { fixture, host, store, catalogos } = await montar(EliminacaoStepComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      publicar(store);
      catalogos.regrasEliminacao.set([regra('ELIM-NOTA-MINIMA-ETAPA')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Regra de eliminação 1', 'ELIM-NOTA-MINIMA-ETAPA — Base de ELIM-NOTA-MINIMA-ETAPA'],
        ['Etapa', 'Não informado'],
        ['Nota mínima', '400'],
      ]);
    });

    it('com o processo publicado e nenhuma regra, diz que não há regra declarada', async () => {
      const { fixture, host, store } = await montar(EliminacaoStepComponent);
      store.patchObjectSection('classificacao', { ...CLASSIFICACAO_LOCAL, regrasEliminacao: [] });
      publicar(store);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(host.textContent).toContain('Nenhuma regra de eliminação declarada.');
    });

    it('com o processo publicado e sem regra de cálculo, não diz que a classificação é importada', async () => {
      const { fixture, host, store } = await montar(EliminacaoStepComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regraCalculoCodigo: '',
        regrasEliminacao: [],
      });
      publicar(store);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(host.textContent).toContain('Nenhuma regra de cálculo declarada no passo Fórmula.');
      expect(host.textContent).not.toContain('importada');
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(EliminacaoStepComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
      expect(controlesEditaveis(host, '#elim-remover-0, #eliminacao-acrescentar')).toEqual([]);
    });

    it('com o processo publicado, acrescentar, trocar e remover pelo código não mudam o rascunho', async () => {
      const { fixture, store } = await montar(EliminacaoStepComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      publicar(store);
      detectar(fixture);
      const componente = fixture.componentInstance;

      componente.acrescentarRegra();
      componente.escolherRegra(0, 'ELIM-ZERO-EM-AREA|1.0');
      componente.removerRegra(0);

      expect(store.draft().classificacao.regrasEliminacao).toEqual([regraGravada]);
    });
  });
});
