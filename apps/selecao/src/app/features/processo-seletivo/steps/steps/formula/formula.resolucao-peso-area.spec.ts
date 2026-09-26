import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { config as configDoRxjs, throwError } from 'rxjs';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { signal } from '@angular/core';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService, type AppConfig } from '@uniplus/shared-data/config';
import { CONFIGURACAO_BASE_PATH, PesosEnemApi } from '@uniplus/shared-data/configuracao';
import {
  SELECAO_BASE_PATH,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { quadroCongelado } from '../../shared/quadro-de-pesos';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { FormulaStepComponent } from './formula.component';

const BASE = 'http://localhost:5000';
const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
const OUTRA_RESOLUCAO = 'Resolução nº 12/2020/Consepe';
const ROTA_PESOS = '/api/configuracao/pesos-area-enem';
const ROTA_AREAS = '/api/configuracao/pesos-area-enem/areas';

/**
 * Linhas do cadastro de Peso por Área. As áreas têm códigos que nenhuma constante da tela
 * conhece: se a tela mostrar "Área de teste A", mostrou o que a API devolveu.
 */
function linha(resolucao: string, grupo: { codigo: string; rotulo: string }, areas: unknown[]) {
  return {
    id: `${resolucao}-${grupo.codigo}`,
    resolucao,
    grupoCurso: grupo,
    areas,
    baseLegal: `${resolucao} – Anexo I`,
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

const TECNOLOGICA = { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' };
const SAUDE = { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' };

const PESOS = [
  linha(RESOLUCAO, TECNOLOGICA, [
    { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 2, corte: 400 },
    { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B', peso: 1.5, corte: null },
  ]),
  linha(RESOLUCAO, SAUDE, [
    { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 3, corte: null },
    { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B', peso: 1, corte: null },
  ]),
  linha(OUTRA_RESOLUCAO, TECNOLOGICA, [
    { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 1, corte: null },
  ]),
];

const ERRO_500 = {
  corpo: { type: 'about:blank', title: 'Erro interno.', status: 500, code: 'x', traceId: 't' },
  opcoes: { status: 500, statusText: 'Internal Server Error' },
};

const SELETOR_RESOLUCAO = '#f-resolucao-peso-area';

interface Montagem {
  readonly fixture: ComponentFixture<FormulaStepComponent>;
  readonly componente: FormulaStepComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly el: HTMLElement;
}

let controllerAtual: HttpTestingController | null = null;

/** Papéis de quem opera o wizard; o link do cadastro depende deles. */
const papeis = signal<readonly string[]>(['plataforma-admin']);

/** A releitura do detalhe que o botão do aviso aciona; cada teste decide o que ela faz. */
const releitura = { reler: vi.fn(async () => true) };

async function montar(
  opcoes: {
    config?: AppConfig;
    pesosApi?: unknown;
    antesDeMontar?: (store: ProcessoSeletivoStore) => void;
  } = {},
): Promise<Montagem> {
  await TestBed.configureTestingModule({
    imports: [FormulaStepComponent],
    providers: [
      ProcessoSeletivoStore,
      CatalogosDeClassificacaoService,
      AcompanhamentoDoCadastroDePesos,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: { roles: papeis, hasRole: (papel: string) => papeis().includes(papel) },
      },
      { provide: ReleituraDoSnapshot, useValue: releitura },
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ...(opcoes.pesosApi ? [{ provide: PesosEnemApi, useValue: opcoes.pesosApi }] : []),
    ],
  }).compileComponents();

  if (opcoes.config) TestBed.inject(AppConfigService).load(opcoes.config);
  const store = TestBed.inject(ProcessoSeletivoStore);
  opcoes.antesDeMontar?.(store);

  const fixture = TestBed.createComponent(FormulaStepComponent);
  const controller = TestBed.inject(HttpTestingController);
  controllerAtual = controller;
  fixture.detectChanges();

  for (const requisicao of controller.match((r) => r.url.includes('/regras-catalogo'))) {
    requisicao.flush([]);
  }
  fixture.detectChanges();

  return {
    fixture,
    componente: fixture.componentInstance,
    store,
    controller,
    el: fixture.nativeElement as HTMLElement,
  };
}

function pedidosDoCadastro(m: Montagem) {
  return m.controller.match((r) => r.url.endsWith(ROTA_PESOS));
}

/** Responde a leitura do cadastro que está pendente — e só uma deve estar. */
function responderPesos(m: Montagem, corpo: readonly object[] = PESOS): void {
  m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush([...corpo]);
  responderAreas(m);
}

/** A lista canônica é lida uma vez só: responde se ela estiver pendente. */
function responderAreas(m: Montagem): void {
  m.controller
    .match((r) => r.url.endsWith(ROTA_AREAS))
    .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
  m.fixture.detectChanges();
}

function falharPesos(m: Montagem): void {
  m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush(ERRO_500.corpo, ERRO_500.opcoes);
  m.controller
    .match((r) => r.url.endsWith(ROTA_AREAS))
    .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
  m.fixture.detectChanges();
}

/** Classificação baseada em ENEM com a média ponderada local — o caso que exige a resolução. */
function marcarEnemComMediaPonderada(m: Montagem): void {
  m.componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
  m.fixture.detectChanges();
  const checkbox = m.el.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox === null) throw new Error('checkbox do ENEM ausente');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change'));
  m.fixture.detectChanges();
}

function escolherNoSeletor(m: Montagem, valor: string): void {
  const select = seletor(m);
  select.value = valor;
  select.dispatchEvent(new Event('change'));
  m.fixture.detectChanges();
}

function seletor(m: Montagem): HTMLSelectElement {
  const select = m.el.querySelector<HTMLSelectElement>(SELETOR_RESOLUCAO);
  if (select === null) throw new Error('seletor da resolução ausente');
  return select;
}

function botao(m: Montagem, rotulo: string): HTMLButtonElement | undefined {
  return [...m.el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    texto(b).includes(rotulo),
  );
}

/** A resolução que a consulta lê, sob o rótulo do campo. */
function resolucaoEmConsulta(m: Montagem): string | undefined {
  return Array.from(m.el.querySelectorAll('dl'))
    .find((par) => texto(par.querySelector('dt')) === 'Resolução de Peso por Área')
    ?.querySelector('dd')
    ?.textContent?.trim();
}

function texto(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Rascunho já com ENEM, média ponderada e a resolução — como fica depois de reabrir o processo. */
function rascunhoComResolucao(resolucao: string) {
  return (store: ProcessoSeletivoStore) =>
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
      regraCalculoVersao: '1.0',
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: resolucao,
    });
}

/** O processo gravou `resolucao` com este quadro — a cópia congelada que o detalhe devolve. */
function processoGravadoCom(
  resolucao: string,
  quadro: unknown[],
  status: StatusProcesso = StatusProcesso.rascunho,
) {
  return (store: ProcessoSeletivoStore) => {
    rascunhoComResolucao(resolucao)(store);
    const classificacao = { resolucaoPesoAreaEnem: resolucao, quadroPesoAreaEnem: quadro };
    store.remoteSnapshot.set({ status, classificacao } as unknown as ProcessoSeletivoDto);
    store.registrarClassificacaoLida(
      classificacao as unknown as ProcessoSeletivoDto['classificacao'],
    );
  };
}

/** As cinco áreas, na ordem canônica do cadastro — a Redação primeiro. */
const AREAS_CANONICAS = [
  { codigo: 'REDACAO', rotulo: 'Redação', peso: 2, corte: 400 },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza', peso: 1.5, corte: null },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas', peso: 2.5, corte: null },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens', peso: 2.5, corte: null },
  { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1.5, corte: null },
];

/** As mesmas áreas na ordem em que a cópia congelada chega: por código. */
const AREAS_POR_CODIGO = [...AREAS_CANONICAS].sort((a, b) => (a.codigo < b.codigo ? -1 : 1));

const ROTULOS_CANONICOS = AREAS_CANONICAS.map((area) => area.rotulo);

/** A lista canônica que `GET …/pesos-area-enem/areas` publica — a ordem de qualquer quadro. */
const AREAS_DO_CADASTRO = [
  ...AREAS_CANONICAS.map(({ codigo, rotulo }) => ({ codigo, rotulo })),
  { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A' },
  { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B' },
];

const QUADRO_CONGELADO = [
  {
    grupoAreaEnem: TECNOLOGICA,
    baseLegal: `${RESOLUCAO} – Anexo I (congelada)`,
    areas: [{ codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 9, corte: 700 }],
  },
];

describe('FormulaStepComponent — resolução de Peso por Área', () => {
  afterEach(() => {
    papeis.set(['plataforma-admin']);
    releitura.reler.mockReset();
    // Solta a referência antes de conferir: uma falha aqui não pode vazar para o teste seguinte.
    const controller = controllerAtual;
    controllerAtual = null;
    controller?.verify();
  });

  describe('quando aparece e quando o cadastro é lido', () => {
    it('com ENEM e média ponderada, revela a escolha com as resoluções do cadastro', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      const opcoes = [...m.el.querySelectorAll<HTMLOptionElement>(`${SELETOR_RESOLUCAO} option`)];
      expect(opcoes.map((opcao) => texto(opcao))).toEqual([
        '— escolher —',
        OUTRA_RESOLUCAO,
        RESOLUCAO,
      ]);
    });

    it('não lê o cadastro enquanto a classificação não exige a resolução', async () => {
      const m = await montar();
      m.componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
      m.componente.alternarBaseadoEmEnem(true);
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector(SELETOR_RESOLUCAO)).toBeNull();
      expect(texto(m.el)).toContain('não há resolução de Peso por Área a escolher');
    });

    it('sem ENEM, não mostra a escolha nem lê o cadastro', async () => {
      const m = await montar();
      m.componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector(SELETOR_RESOLUCAO)).toBeNull();
    });
  });

  describe('seletor mostra a escolha do rascunho', () => {
    it('ao reabrir o processo, o seletor mostra a resolução hidratada', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      expect(seletor(m).value).toBe(RESOLUCAO);
    });

    it('a seção recriada com a resolução no rascunho mostra a escolha', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      m.store.patchObjectSection('classificacao', { baseadoEmEnem: false });
      m.fixture.detectChanges();
      m.store.patchObjectSection('classificacao', { baseadoEmEnem: true });
      m.fixture.detectChanges();

      expect(seletor(m).value).toBe(RESOLUCAO);
    });

    it('tirar a regra de cálculo guarda a resolução no rascunho e descarta a recusa', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);
      m.store.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      m.componente.escolherRegraCalculo('|');

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('trocar para a nota importada e voltar devolve a escolha, sem a recusa', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);
      m.store.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      m.componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
      m.fixture.detectChanges();
      m.componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      m.fixture.detectChanges();

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(seletor(m).value).toBe(RESOLUCAO);
    });
  });

  describe('quadro', () => {
    it('antes de gravar, mostra a prévia do cadastro, com os dados que a API devolveu', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);

      const tabela = m.el.querySelector('table');
      const legenda = texto(tabela?.querySelector('caption') ?? null);
      expect(legenda).toContain(RESOLUCAO);
      expect(legenda).toContain('Prévia');
      expect(legenda).toContain('será copiado para o processo');

      const cabecalhos = [...(tabela?.querySelectorAll('thead th') ?? [])].map(texto);
      // A base legal é a mesma nos dois grupos: dita uma vez acima do quadro, e não em coluna.
      expect(cabecalhos).toEqual(['Grupo de área', 'Área de teste A', 'Área de teste B']);
      expect(texto(m.el.querySelector('.peso-area__base-legal'))).toBe(
        `Base legal: ${RESOLUCAO} – Anexo I`,
      );

      const linhas = [...(tabela?.querySelectorAll('tbody tr') ?? [])];
      // Grupos pelo código, a mesma ordem da cópia que o servidor congela.
      expect(linhas.map((tr) => texto(tr.querySelector('th[scope="row"]')))).toEqual([
        'Saúde e Biológicas',
        'Tecnológica',
      ]);

      // Mesma formatação do cadastro de Peso por Área: pt-BR, sem casas fixas.
      const tecnologica = linhas[1].querySelectorAll('td');
      expect(texto(tecnologica[0])).toBe('Peso 2 corte 400');
      expect(texto(tecnologica[1])).toBe('Peso 1,5');
      expect(tecnologica).toHaveLength(2);
    });

    it('com bases legais diferentes entre os grupos, mostra a de cada um na sua linha', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [PESOS[0], { ...PESOS[1], baseLegal: `${RESOLUCAO} – Anexo II` }]);
      escolherNoSeletor(m, RESOLUCAO);

      const tabela = m.el.querySelector('table');
      const cabecalhos = [...(tabela?.querySelectorAll('thead th') ?? [])].map(texto);
      expect(cabecalhos.at(-1)).toBe('Base legal');
      const basesLegais = [...(tabela?.querySelectorAll('td[data-label="Base legal"]') ?? [])];
      expect(basesLegais.map(texto)).toEqual([`${RESOLUCAO} – Anexo II`, `${RESOLUCAO} – Anexo I`]);
      expect(m.el.querySelector('.peso-area__base-legal')).toBeNull();
    });

    it('não repete a palavra "resolução" antes do nome dela', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);

      expect(texto(m.el.querySelector('caption')).toLowerCase()).not.toContain(
        'resolução resolução',
      );
    });

    it('a opção do ENEM anuncia o corte por área, que vale para qualquer área e não só a redação', async () => {
      const m = await montar();

      const opcao = texto(m.el.querySelector('.check-item'));
      expect(opcao).toContain('corte por área');
      expect(opcao).not.toContain('corte de redação');
    });

    it('com a resolução gravada, mostra a cópia congelada no processo, e não o cadastro', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);

      const tabela = m.el.querySelector('table');
      expect(texto(tabela?.querySelector('caption') ?? null)).toContain('congelado no processo');
      const linhas = [...(tabela?.querySelectorAll('tbody tr') ?? [])];
      expect(linhas).toHaveLength(1);
      expect(texto(linhas[0].querySelectorAll('td')[0])).toBe('Peso 9 corte 700');
      expect(texto(m.el.querySelector('.peso-area__base-legal'))).toBe(
        `Base legal: ${RESOLUCAO} – Anexo I (congelada)`,
      );
      // O cadastro mudou depois da cópia: o operador precisa saber o que a próxima gravação faz.
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');
    });

    it('um grupo congelado que saiu do cadastro avisa que a próxima gravação será recusada', async () => {
      const m = await montar({
        antesDeMontar: processoGravadoCom(RESOLUCAO, [
          ...QUADRO_CONGELADO,
          {
            grupoAreaEnem: SAUDE,
            baseLegal: `${RESOLUCAO} – Anexo I`,
            areas: [{ codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 3, corte: null }],
          },
        ]),
      });
      responderPesos(m, [PESOS[0]]);

      expect(texto(m.el)).toContain('será recusada até a resolução ser completada no cadastro');
      expect(texto(m.el)).not.toContain('copia os valores atuais do cadastro');
    });

    it('cópia e cadastro iguais, em ordens diferentes, não geram aviso, e as colunas seguem a ordem do cadastro', async () => {
      const m = await montar({
        antesDeMontar: processoGravadoCom(RESOLUCAO, [
          {
            grupoAreaEnem: TECNOLOGICA,
            baseLegal: `${RESOLUCAO} – Anexo I`,
            areas: AREAS_POR_CODIGO,
          },
        ]),
      });
      responderPesos(m, [linha(RESOLUCAO, TECNOLOGICA, AREAS_CANONICAS)]);

      expect(texto(m.el.querySelector('caption'))).toContain('congelado no processo');
      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
      const cabecalhos = [...m.el.querySelectorAll('thead th')].map(texto);
      expect(cabecalhos.slice(1)).toEqual(ROTULOS_CANONICOS);
    });

    it('só compara a cópia com um cadastro lido depois dela, e relê o cadastro a cada cópia nova', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');

      // Outra gravação congelou outro quadro: o cadastro em mãos é anterior à cópia nova.
      const outraCopia = [{ ...QUADRO_CONGELADO[0], baseLegal: `${RESOLUCAO} – Anexo II` }];
      processoGravadoCom(RESOLUCAO, outraCopia)(m.store);
      m.fixture.detectChanges();
      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');

      // O cadastro relido depois da cópia volta a poder dizer que ela ficou para trás.
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');
    });

    it('com a releitura automática do cadastro em falha, o seletor mantém as resoluções lidas antes', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);

      const outraCopia = [{ ...QUADRO_CONGELADO[0], baseLegal: `${RESOLUCAO} – Anexo II` }];
      processoGravadoCom(RESOLUCAO, outraCopia)(m.store);
      m.fixture.detectChanges();
      falharPesos(m);

      const opcoes = Array.from(
        m.el.querySelectorAll<HTMLOptionElement>(`${SELETOR_RESOLUCAO} option`),
      );
      expect(opcoes.map((opcao) => texto(opcao))).toEqual([
        '— escolher —',
        OUTRA_RESOLUCAO,
        RESOLUCAO,
      ]);
      expect(seletor(m).disabled).toBe(false);
      // A lista anterior só serve de prévia: a cópia nova não é julgada contra ela.
      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
    });

    it('a releitura que traz a mesma cópia não relê o cadastro nem descarta o lido', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);

      processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO)(m.store);
      m.fixture.detectChanges();

      expect(m.controller.match((r) => r.url.endsWith(ROTA_PESOS))).toHaveLength(0);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');
    });

    it('"Reler o processo" relê o detalhe ali mesmo e, quando o aviso sai, foca o título', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);
      const gravada = m.store.classificacaoGravada();
      m.store.marcarClassificacaoDesconhecida();
      m.fixture.detectChanges();
      releitura.reler.mockImplementation(async () => {
        m.store.classificacaoGravada.set(gravada);
        return true;
      });

      const reler = botao(m, 'Reler o processo');
      expect(reler?.closest('[role="status"]')).not.toBeNull();
      reler?.focus();
      reler?.click();
      await m.fixture.whenStable();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(releitura.reler).toHaveBeenCalledTimes(1);
      expect(botao(m, 'Reler o processo')).toBeUndefined();
      expect(document.activeElement?.id).toBe('peso-area-titulo');
    });

    it('"Reler o processo" superado por outra leitura não mexe no foco', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);
      const gravada = m.store.classificacaoGravada();
      m.store.marcarClassificacaoDesconhecida();
      m.fixture.detectChanges();
      releitura.reler.mockImplementation(async () => {
        m.store.classificacaoGravada.set(gravada);
        return false;
      });

      const reler = botao(m, 'Reler o processo');
      reler?.focus();
      reler?.click();
      await m.fixture.whenStable();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).not.toBe('peso-area-titulo');
    });

    it('os avisos do quadro são regiões vivas, para o leitor de tela anunciá-los', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);

      const aviso = [...m.el.querySelectorAll('.alert--warning')].find((el) =>
        texto(el).includes('O cadastro de Peso por Área mudou depois'),
      );
      expect(aviso?.getAttribute('role')).toBe('status');
    });

    it('colunas na ordem canônica mesmo com grupos em ordens diferentes', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [
        linha(RESOLUCAO, TECNOLOGICA, [...AREAS_POR_CODIGO]),
        linha(RESOLUCAO, SAUDE, [...AREAS_CANONICAS].reverse()),
      ]);
      escolherNoSeletor(m, RESOLUCAO);

      const cabecalhos = [...m.el.querySelectorAll('thead th')].map(texto);
      expect(cabecalhos.slice(1)).toEqual(ROTULOS_CANONICOS);
    });

    it('a prévia do cadastro tem as colunas na mesma ordem da cópia congelada', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [linha(RESOLUCAO, TECNOLOGICA, AREAS_CANONICAS)]);
      escolherNoSeletor(m, RESOLUCAO);

      const cabecalhos = [...m.el.querySelectorAll('thead th')].map(texto);
      expect(cabecalhos.slice(1)).toEqual(ROTULOS_CANONICOS);
    });

    it('releitura falha depois de gravar: não mostra a cópia velha como congelada e avisa', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);
      m.store.marcarClassificacaoDesconhecida();
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
      expect(texto(m.el)).toContain('Não se sabe o que a classificação gravada tem agora');
    });

    it('a cópia que a gravação presumiu não é dada como congelada: falta confirmá-la, e o aviso oferece reler', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);
      m.store.registrarClassificacaoGravadaComQuadro(RESOLUCAO, quadroCongelado(QUADRO_CONGELADO));
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
      expect(texto(m.el)).not.toContain('congelado no processo');
      expect(texto(m.el)).toContain('ainda não foi confirmado por uma releitura');
      expect(botao(m, 'Reler o processo')).toBeDefined();
    });

    it('não esconde a cópia congelada quando a resolução saiu do cadastro', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m, [PESOS[2]]);

      expect(texto(m.el.querySelector('tbody tr td'))).toBe('Peso 9 corte 700');
      expect(texto(m.el)).toContain('não está no cadastro de Peso por Área lido');
    });

    it('marca a área que falta a um grupo em vez de sumir com a coluna', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m, [
        linha(RESOLUCAO, TECNOLOGICA, [
          { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 2, corte: null },
        ]),
        linha(RESOLUCAO, SAUDE, [
          { codigo: 'AREA_TESTE_A', rotulo: 'Área de teste A', peso: 3, corte: null },
          { codigo: 'AREA_TESTE_B', rotulo: 'Área de teste B', peso: 1, corte: null },
        ]),
      ]);
      escolherNoSeletor(m, RESOLUCAO);

      const tecnologica = m.el.querySelectorAll('tbody tr')[1].querySelectorAll('td');
      expect(texto(tecnologica[1])).toContain('sem peso nesta resolução');
    });
  });

  describe('resolução fora do cadastro', () => {
    it('só marca "fora do cadastro" depois de o cadastro ter sido lido', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao('Resolução revogada') });

      const enquantoCarrega = [...m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`)].map(texto);
      expect(enquantoCarrega).toContain('Resolução revogada');
      expect(enquantoCarrega.join(' ')).not.toContain('fora do cadastro');

      falharPesos(m);
      const depoisDaFalha = [...m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`)].map(texto);
      expect(depoisDaFalha.join(' ')).not.toContain('fora do cadastro');
    });

    it('avisa, continua a oferecê-la e bloqueia o avanço com a pendência no campo', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao('Resolução revogada') });
      responderPesos(m);
      m.store.patchObjectSection('classificacao', {
        regraArredondamentoCodigo: 'ARRED-TRUNCAR',
        regraArredondamentoVersao: '1.0',
        casasArredondamento: '2',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
        nOpcoesAlocacao: '2',
      });
      m.fixture.detectChanges();

      const opcoes = [...m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`)].map(texto);
      expect(opcoes).toContain('Resolução revogada (fora do cadastro)');
      expect(texto(m.el)).toContain('não está no cadastro de Peso por Área lido');

      const resultado = m.componente.validate();
      m.fixture.detectChanges();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toEqual([
        'A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo Fórmula; senão, escolha outra.',
      ]);
      expect(seletor(m).getAttribute('aria-invalid')).toBe('true');
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Esta resolução não está no cadastro lido. Use "Atualizar lista" se ela foi criada agora, ou escolha outra.',
      );
    });
  });

  describe('troca de processo', () => {
    /** O que a página faz ao abrir outro processo: limpa o editor, e a leitura dele chega. */
    function abrirOutroProcesso(
      m: Montagem,
      antesDeHidratar: (store: ProcessoSeletivoStore) => void,
    ) {
      m.store.reset();
      m.componente.catalogos.esquecerPesosAreaEnem();
      antesDeHidratar(m.store);
      m.fixture.detectChanges();
    }

    it('criar o processo (o id nasce) mantém a lista lida e a prévia', async () => {
      const m = await montar({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      m.store.processoSeletivoId.set('processo-criado');
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      const opcoes = [...m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`)].map(texto);
      expect(opcoes).toContain(RESOLUCAO);
      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
    });

    it('outro processo aberto por hidratação relê o cadastro', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);

      abrirOutroProcesso(m, processoGravadoCom(OUTRA_RESOLUCAO, QUADRO_CONGELADO));

      expect(m.componente.catalogos.pesosLidosNaMarca()).toBe(-1);
      responderPesos(m);
      expect(m.componente.catalogos.pesosLidosNaMarca()).toBe(m.store.versaoDaClassificacaoLida());
    });

    it('um processo só para consulta, aberto depois de outro, não herda a lista do anterior', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);
      expect(m.componente.catalogos.resolucoesPesoAreaEnem()).not.toEqual([]);

      abrirOutroProcesso(
        m,
        processoGravadoCom(OUTRA_RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado),
      );

      expect(m.componente.catalogos.resolucoesPesoAreaEnem()).toEqual([]);
      expect(m.componente.catalogos.pesosLidosNaMarca()).toBe(-1);
      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(resolucaoEmConsulta(m)).toBe(OUTRA_RESOLUCAO);
    });
  });

  describe('processo que não aceita edição', () => {
    it('não lê o cadastro, lê a resolução como texto e mostra a cópia congelada', async () => {
      const m = await montar({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado),
      });
      responderAreas(m);

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector('select, input, button')).toBeNull();
      expect(resolucaoEmConsulta(m)).toBe(RESOLUCAO);
      expect(texto(m.el.querySelector('caption'))).toContain('congelado no processo');
      expect(texto(m.el.querySelector('tbody tr td'))).toBe('Peso 9 corte 700');
    });

    it('publicado nesta sessão, deixa de avisar da próxima gravação', async () => {
      const m = await montar({ antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO) });
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');

      processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado)(m.store);
      m.fixture.detectChanges();

      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
      expect(texto(m.el)).not.toContain('não está no cadastro de Peso por Área lido');
    });

    it('não troca a resolução nem apaga a recusa guardada', async () => {
      const m = await montar({
        antesDeMontar: (store) => {
          rascunhoComResolucao(RESOLUCAO)(store);
          store.remoteSnapshot.set({
            status: StatusProcesso.publicado,
          } as unknown as ProcessoSeletivoDto);
          store.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');
        },
      });
      // Sem cópia congelada, o quadro à vista só pode vir do cadastro, mesmo só para consulta.
      responderPesos(m);

      m.componente.escolherResolucao(OUTRA_RESOLUCAO);

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
    });
  });

  describe('obrigatoriedade e limpeza', () => {
    it('desmarcar e remarcar o ENEM deixa o seletor vazio, sem a recusa, e bloqueia o avanço', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      m.componente.alternarBaseadoEmEnem(false);
      m.fixture.detectChanges();
      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe('');
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBeNull();

      m.componente.alternarBaseadoEmEnem(true);
      m.fixture.detectChanges();
      expect(seletor(m).value).toBe('');
      expect(m.componente.validate().valid).toBe(false);
    });

    it('marcado sem escolha, bloqueia o avanço e aponta a pendência no campo', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      m.store.patchObjectSection('classificacao', {
        regraArredondamentoCodigo: 'ARRED-TRUNCAR',
        regraArredondamentoVersao: '1.0',
        casasArredondamento: '2',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
        nOpcoesAlocacao: '2',
      });

      const resultado = m.componente.validate();
      m.fixture.detectChanges();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toEqual([
        'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula.',
      ]);
      const select = seletor(m);
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(select.getAttribute('aria-describedby')?.split(' ')).toContain(
        'f-resolucao-peso-area-erro',
      );
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Selecione a resolução de Peso por Área usada na nota.',
      );

      escolherNoSeletor(m, RESOLUCAO);
      expect(m.componente.validate().valid).toBe(true);
      m.fixture.detectChanges();
      expect(m.el.querySelector('#f-resolucao-peso-area-erro')).toBeNull();
    });

    it('mostra sob o campo a recusa guardada e só a tira quando a escolha muda de fato', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.recusaDaResolucaoPesoAreaEnem.set('Recusa do servidor.');
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe('Recusa do servidor.');

      m.componente.escolherResolucao(RESOLUCAO);
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa do servidor.');

      escolherNoSeletor(m, OUTRA_RESOLUCAO);
      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(m.el.querySelector('#f-resolucao-peso-area-erro')).toBeNull();
    });

    it('mostra sob o campo também a recusa por um critério de desempate, e a tira com a troca de resolução', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.recusaDaResolucaoPesoAreaEnem.set('Recusa da resolução.');
      m.store.recusaPeloDesempatePorArea.set('Recusa pelo desempate.');
      m.fixture.detectChanges();

      // As duas recusas vigentes, e não uma escondendo a outra.
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Recusa da resolução. Recusa pelo desempate.',
      );

      escolherNoSeletor(m, OUTRA_RESOLUCAO);
      expect(m.store.recusaPeloDesempatePorArea()).toBeNull();
    });
  });

  describe('rótulo, link e lista do cadastro', () => {
    it('o rótulo do checkbox anuncia também a resolução de Peso por Área', async () => {
      const m = await montar();

      expect(texto(m.el.querySelector('label.check-item'))).toContain(
        'define a resolução de Peso por Área',
      );
    });

    it('liga o seletor ao próprio rótulo e à dica', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(texto(m.el.querySelector('label[for="f-resolucao-peso-area"]'))).toBe(
        'Resolução de Peso por Área',
      );
      expect(seletor(m).getAttribute('aria-describedby')).toBe('f-resolucao-peso-area-dica');
    });

    it('aponta o cadastro de Peso por Área no mesmo host quando o ambiente não declara a origem', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      const link = m.el.querySelector<HTMLAnchorElement>('#f-resolucao-peso-area-dica a');
      expect(link?.getAttribute('href')).toBe('/configuracao/pesos-por-area');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener');
      expect(texto(link)).toBe('Abrir o cadastro de Peso por Área (abre em nova aba)');
    });

    it('usa a origem do app da Configuração que o ambiente declara', async () => {
      const m = await montar({
        config: {
          apiUrl: BASE,
          configuracaoWebUrl: 'http://localhost:4203',
          oidc: { issuerUrl: 'http://localhost:8080/realms/unifesspa', clientId: 'selecao-web' },
        },
      });
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(m.el.querySelector('#f-resolucao-peso-area-dica a')?.getAttribute('href')).toBe(
        'http://localhost:4203/pesos-por-area',
      );
    });

    it('sem o papel de administração, não oferece o link e diz quem cadastra as resoluções', async () => {
      papeis.set(['avaliador']);
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(m.el.querySelector('#f-resolucao-peso-area-dica a')).toBeNull();
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-dica'))).toContain(
        'As resoluções são cadastradas pela administração da plataforma.',
      );
    });

    it('com uma leitura em curso, "Atualizar lista" parece e age como indisponível', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m);
      m.componente.catalogos.recarregarPesosAreaEnem(m.store.versaoDaClassificacaoLida());
      m.fixture.detectChanges();

      const atualizar = botao(m, 'Atualizar lista');
      expect(atualizar?.getAttribute('aria-disabled')).toBe('true');
      atualizar?.click();
      m.fixture.detectChanges();

      // O clique não pediu outra leitura nem apagou o anúncio da anterior.
      expect(m.controller.match((r) => r.url.endsWith(ROTA_PESOS))).toHaveLength(1);
      expect(texto(m.el.querySelector('.peso-area__acoes [role="status"]'))).toBe(
        'Lista de resoluções de Peso por Área atualizada.',
      );
      m.controller.match((r) => r.url.endsWith(ROTA_AREAS)).forEach((r) => r.flush([]));
    });

    it('"Atualizar lista" relê o cadastro e traz a resolução criada na outra aba', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m, [...PESOS, linha('Resolução criada agora', TECNOLOGICA, [])]);

      const opcoes = [...m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`)].map(texto);
      expect(opcoes).toContain('Resolução criada agora');
      expect(texto(m.el.querySelector('.peso-area__acoes [role="status"]'))).toBe(
        'Lista de resoluções de Peso por Área atualizada.',
      );
    });

    it('"Atualizar lista" tira a recusa guardada, que o servidor julga de novo na próxima gravação', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.recusaDaResolucaoPesoAreaEnem.set('A resolução estava incompleta.');
      m.fixture.detectChanges();

      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m);

      expect(m.store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(seletor(m).getAttribute('aria-invalid')).toBeNull();
    });
  });

  describe('falha do cadastro de Peso por Área', () => {
    it('mantém o alerta durante a nova tentativa; quando a lista chega, leva o foco ao seletor', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);

      const tentar = botao(m, 'Tentar novamente');
      expect(texto(m.el.querySelector('.peso-area [role="alert"]'))).toContain(
        'Não foi possível carregar o cadastro de Peso por Área',
      );
      tentar?.focus();
      tentar?.click();
      m.fixture.detectChanges();

      expect(tentar?.isConnected).toBe(true);
      expect(tentar?.getAttribute('aria-disabled')).toBe('true');
      expect(texto(tentar ?? null)).toBe('Carregando…');

      responderPesos(m);
      await m.fixture.whenStable();

      expect(m.el.querySelector('.peso-area [role="alert"]')).toBeNull();
      expect(document.activeElement?.id).toBe('f-resolucao-peso-area');
    });

    it('a nova tentativa que termina com o passo já desmontado não tenta focar', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      botao(m, 'Tentar novamente')?.click();
      m.fixture.detectChanges();
      const erroNaoTratado = vi.fn();
      const anterior = configDoRxjs.onUnhandledError;
      configDoRxjs.onUnhandledError = erroNaoTratado;

      try {
        m.fixture.destroy();
        m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush([...PESOS]);
        m.controller
          .match((r) => r.url.endsWith(ROTA_AREAS))
          .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
        await new Promise((resolve) => setTimeout(resolve));
      } finally {
        configDoRxjs.onUnhandledError = anterior;
      }

      expect(erroNaoTratado).not.toHaveBeenCalled();
    });

    it('sem edição, a nova tentativa que dá certo leva o foco ao título da seção', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      // Uma gravação em curso trava a edição: o seletor fica desabilitado.
      m.store.salvando.set(true);
      m.fixture.detectChanges();

      const tentar = botao(m, 'Tentar novamente');
      tentar?.focus();
      tentar?.click();
      m.fixture.detectChanges();
      responderPesos(m);
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('peso-area-titulo');
    });

    it('reanuncia a falha quando a nova tentativa também falha', async () => {
      const m = await montar();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      const primeira = texto(m.el.querySelector('.peso-area [role="alert"] p'));

      botao(m, 'Tentar novamente')?.click();
      m.fixture.detectChanges();
      falharPesos(m);
      const segunda = texto(m.el.querySelector('.peso-area [role="alert"] p'));

      expect(segunda).not.toBe(primeira);
      expect(segunda).toContain('Não foi possível carregar o cadastro de Peso por Área');
    });

    it('trata o erro que escapa do envelope da API como falha, com nova tentativa', async () => {
      const m = await montar({
        pesosApi: {
          listar: () => throwError(() => new Error('falha fora do envelope')),
          listarAreas: () => throwError(() => new Error('falha fora do envelope')),
        },
      });
      marcarEnemComMediaPonderada(m);

      expect(m.componente.catalogos.pesosCarregando()).toBe(false);
      expect(texto(m.el.querySelector('.peso-area [role="alert"]'))).toContain('Tentar novamente');
    });
  });
});
