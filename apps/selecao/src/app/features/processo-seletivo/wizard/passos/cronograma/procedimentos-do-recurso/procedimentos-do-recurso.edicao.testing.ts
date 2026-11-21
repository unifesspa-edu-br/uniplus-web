import { ApplicationRef, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
  type DocumentoDaConfiguracaoItemDeAvaliacao,
} from '@uniplus/shared-data/selecao';
import { RegrasCatalogoApi } from '@uniplus/shared-data/selecao';
import { vi, type Mock } from 'vitest';

import type { ModoDaSecao } from '../../../shared/modo-da-secao';
import type {
  ItemDeAvaliacaoDaEtapa,
  ProcedimentoDeRecurso,
} from '../../../processo-seletivo.models';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import { ProcedimentosDoRecursoComponent } from './procedimentos-do-recurso.component';
import { regraDoCatalogo } from './procedimentos.testing';
import type { RecusaDoProcedimento } from './recusas-do-procedimento';
import {
  provideProcessoLidoComOsTiposDeDecisao,
  provideTiposDeDecisaoDaApi,
} from '../../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';

export type FixtureDosProcedimentos = ComponentFixture<ProcedimentosDoRecursoComponent>;

export interface EntradasDaEdicao {
  readonly procedimentos: readonly (
    | DocumentoDaConfiguracaoProcedimentoDeRecurso
    | ProcedimentoDeRecurso
  )[];
  readonly itensDaEtapa: readonly (
    | DocumentoDaConfiguracaoItemDeAvaliacao
    | ItemDeAvaliacaoDaEtapa
  )[];
  readonly tiposDeclarados: readonly string[];
  readonly areasDoEnem: readonly string[];
  readonly modo: ModoDaSecao;
  readonly temJanela: boolean;
  readonly sugestao: { readonly codigo: string; readonly versao: string } | null;
  readonly recusas: readonly RecusaDoProcedimento[];
}

export const ID_DO_TITULO = 'proc';
export const HOMOLOGACAO = TipoDeDecisaoDoDocumento.HOMOLOGACAO_DAS_INSCRICOES;
export const NOTA = TipoDeDecisaoDoDocumento.NOTA_DA_ETAPA;
export const COLEGIADO = 'PROCEDIMENTO-RECURSO-COLEGIADO|v1';
export const MONOCRATICO = 'PROCEDIMENTO-RECURSO-MONOCRATICO|v1';

const ENTRADAS_PADRAO: EntradasDaEdicao = {
  procedimentos: [],
  itensDaEtapa: [],
  tiposDeclarados: [HOMOLOGACAO],
  areasDoEnem: [],
  modo: 'edicao',
  recusas: [],
  temJanela: true,
  sugestao: null,
};

/** Os eventos que o componente emite, para o teste conferir o que quem monta receberia. */
export interface EventosDaEdicao {
  readonly declarar: Mock;
  readonly trocarRegra: Mock;
  readonly remover: Mock;
  readonly trocarModo: Mock;
}

export interface MontagemDaEdicao {
  readonly fixture: FixtureDosProcedimentos;
  readonly raiz: HTMLElement;
  readonly eventos: EventosDaEdicao;
}

/** Deixa a tela se atualizar, inclusive o que roda depois da renderização. */
export async function assentar(fixture: FixtureDosProcedimentos): Promise<void> {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
  await new Promise((resolver) => setTimeout(resolver));
}

/** Muda só as entradas informadas, como faz quem monta a seção ao atualizar o documento. */
export async function atualizar(
  fixture: FixtureDosProcedimentos,
  entradas: Partial<EntradasDaEdicao>,
): Promise<void> {
  for (const [nome, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nome, valor);
  await assentar(fixture);
}

function provedoresDaEdicao(): Provider[] {
  return [
    CatalogoDeRegras,
    { provide: RegrasCatalogoApi, useValue: { listar: vi.fn() } },
    provideTiposDeDecisaoDaApi(),
    provideProcessoLidoComOsTiposDeDecisao(),
  ];
}

function preparar(): void {
  TestBed.configureTestingModule({ providers: provedoresDaEdicao() });
  const catalogo = TestBed.inject(CatalogoDeRegras);
  catalogo.regrasProcedimento.set([
    regraDoCatalogo('PROCEDIMENTO-RECURSO-COLEGIADO', 'Resolução 12/2020, art. 4º'),
    regraDoCatalogo('PROCEDIMENTO-RECURSO-MONOCRATICO', 'Resolução 12/2020, art. 5º'),
  ]);
  catalogo.carregando.set(false);
}

function ouvir(fixture: FixtureDosProcedimentos): EventosDaEdicao {
  const eventos = {
    declarar: vi.fn(),
    trocarRegra: vi.fn(),
    remover: vi.fn(),
    trocarModo: vi.fn(),
  };
  const componente = fixture.componentInstance;
  componente.declarar.subscribe(eventos.declarar);
  componente.trocarRegra.subscribe(eventos.trocarRegra);
  componente.remover.subscribe(eventos.remover);
  componente.trocarModo.subscribe(eventos.trocarModo);
  return eventos;
}

/** O componente montado no documento da página, para o foco e o axe enxergarem a árvore real. */
export async function montarEdicao(
  entradas: Partial<EntradasDaEdicao> = {},
): Promise<MontagemDaEdicao> {
  preparar();
  const fixture = TestBed.createComponent(ProcedimentosDoRecursoComponent);
  document.body.appendChild(fixture.nativeElement);
  const eventos = ouvir(fixture);
  fixture.componentRef.setInput('idDoTitulo', ID_DO_TITULO);
  await atualizar(fixture, { ...ENTRADAS_PADRAO, ...entradas });
  return { fixture, raiz: fixture.nativeElement as HTMLElement, eventos };
}

/** O seletor da linha de posição `posicao` do tipo de decisão. */
export function seletorDa(raiz: HTMLElement, tipo = HOMOLOGACAO, posicao = 0): HTMLSelectElement {
  return raiz.querySelector(`#${ID_DO_TITULO}-${tipo}-${posicao}-regra`) as HTMLSelectElement;
}

/** Faz o que a pessoa faz: escolhe a opção no seletor e dispara a mudança. */
export function escolher(seletor: HTMLSelectElement, chave: string): void {
  seletor.value = chave;
  seletor.dispatchEvent(new Event('change'));
}

export function textoDe(raiz: HTMLElement): string {
  return (raiz.textContent ?? '').replace(/\s+/g, ' ');
}

export function rotulosDosTipos(raiz: HTMLElement): string[] {
  const legendas = raiz.querySelectorAll('sel-procedimento-do-tipo > fieldset > legend');
  return Array.from(legendas, (legenda) => legenda.textContent?.trim() ?? '');
}
