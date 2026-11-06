import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, groupBy, map, mergeMap, Subject, switchMap } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';
import {
  MUNICIPIO_BUSCA_DEBOUNCE_MS,
  MUNICIPIO_BUSCA_VAZIA,
  type MunicipioBuscaRequest,
  type MunicipioBuscaState,
  type MunicipioOpcao,
  MUNICIPIOS_LIMIT,
  TAMANHO_MINIMO_DA_BUSCA_DE_MUNICIPIO,
} from './calendario-dias-uteis.util';
import {
  aplicarAbrangencia,
  gravarOpcaoEscolhida,
  type GrupoDoDia,
  limparSnapshotMunicipal,
  municipioSelecionadoDe,
  reiniciarBuscaDoMunicipio,
  ufDaBuscaDe,
} from './dia-nao-util-form';

/** O que a pessoa fez no local do dia: a abrangência, o estado, a busca ou a escolha do município. */
export type AlteracaoDoLocal =
  | { readonly tipo: 'abrangencia' }
  | { readonly tipo: 'uf' }
  | { readonly tipo: 'busca'; readonly termo: string }
  | { readonly tipo: 'novaTentativa' }
  | { readonly tipo: 'municipio' };

export type BuscasPorDia = ReadonlyMap<GrupoDoDia, MunicipioBuscaState>;

const TAMANHO_DA_UF = 2;

/**
 * A busca de municípios na API Geo de cada dia em edição. Debounce e cancelamento são por dia:
 * com um fluxo único, digitar na busca de um segundo dia descartaria a do primeiro, que ficaria em
 * "Buscando…" sem opção para gravar o snapshot. O fluxo de cada dia vive até a página ser destruída,
 * porque expirá-lo por inatividade deixaria uma requisição em voo sobreviver ao fluxo, e a busca
 * seguinte não a cancelaria.
 */
@Injectable()
export class BuscaDeMunicipios {
  private readonly geo = inject(GeoApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pedidos = new Subject<MunicipioBuscaRequest>();
  private readonly estados = signal<BuscasPorDia>(new Map());

  readonly buscas = this.estados.asReadonly();

  constructor() {
    this.pedidos
      .pipe(
        groupBy((pedido) => pedido.grupo),
        mergeMap((dia) =>
          dia.pipe(
            debounceTime(MUNICIPIO_BUSCA_DEBOUNCE_MS),
            switchMap((pedido) =>
              this.geo
                .listarCidades({ uf: pedido.uf, q: pedido.termo, limit: MUNICIPIOS_LIMIT })
                .pipe(map((result) => ({ pedido, result }))),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ pedido, result }) => this.aplicarResultado(pedido, result));
  }

  aplicar(grupo: GrupoDoDia, alteracao: AlteracaoDoLocal): void {
    switch (alteracao.tipo) {
      case 'abrangencia':
        aplicarAbrangencia(grupo);
        this.definir(grupo, MUNICIPIO_BUSCA_VAZIA);
        break;
      case 'uf':
        this.mudarUf(grupo);
        break;
      case 'busca':
        this.buscar(grupo, alteracao.termo);
        break;
      case 'novaTentativa':
        this.pedir(grupo, grupo.controls.buscaMunicipio.value.trim());
        break;
      case 'municipio':
        this.escolher(grupo);
        break;
    }
  }

  /** O dia saiu do formulário: a busca dele deixa de existir, e a resposta em voo é descartada. */
  descartar(grupo: GrupoDoDia): void {
    this.estados.update((estados) => {
      const restantes = new Map(estados);
      restantes.delete(grupo);
      return restantes;
    });
  }

  private mudarUf(grupo: GrupoDoDia): void {
    if (grupo.controls.abrangencia.value !== 'MUNICIPAL') {
      return;
    }
    reiniciarBuscaDoMunicipio(grupo);
    this.definir(grupo, MUNICIPIO_BUSCA_VAZIA);
  }

  private buscar(grupo: GrupoDoDia, termo: string): void {
    if (grupo.controls.abrangencia.value !== 'MUNICIPAL') {
      return;
    }
    grupo.controls.buscaMunicipio.setValue(termo, { emitEvent: false });
    const selecionado = municipioSelecionadoDe(grupo);
    if (
      selecionado &&
      termo.trim().localeCompare(selecionado.nome, 'pt-BR', { sensitivity: 'base' }) !== 0
    ) {
      limparSnapshotMunicipal(grupo);
    }
    if (!this.pedir(grupo, termo.trim())) {
      this.definir(grupo, MUNICIPIO_BUSCA_VAZIA);
    }
  }

  /** Dispara a consulta quando há termo e estado suficientes; devolve se disparou. */
  private pedir(grupo: GrupoDoDia, termo: string): boolean {
    const uf = ufDaBuscaDe(grupo);
    if (termo.length < TAMANHO_MINIMO_DA_BUSCA_DE_MUNICIPIO || uf.length !== TAMANHO_DA_UF) {
      return false;
    }
    this.definir(grupo, { ...this.estadoDe(grupo), carregando: true, erro: false });
    this.pedidos.next({ grupo, termo, uf });
    return true;
  }

  private escolher(grupo: GrupoDoDia): void {
    const codigo = grupo.controls.codigoMunicipio.value;
    const opcao = this.estadoDe(grupo).opcoes.find((candidata) => candidata.codigoIbge === codigo);
    if (opcao) {
      gravarOpcaoEscolhida(grupo, opcao);
      // A resposta em voo é descartada, pois o termo passou a ser o nome escolhido: sem isto,
      // a busca seguiria em "Buscando…" sem que nada viesse encerrá-la.
      this.definir(grupo, { ...this.estadoDe(grupo), carregando: false });
    } else {
      limparSnapshotMunicipal(grupo);
    }
  }

  private aplicarResultado(
    pedido: MunicipioBuscaRequest,
    result: ApiResult<readonly CidadeResumoDto[]>,
  ): void {
    const { grupo } = pedido;
    const termoAtual = grupo.controls.buscaMunicipio.value.trim();
    if (
      !this.estados().has(grupo) ||
      termoAtual !== pedido.termo ||
      ufDaBuscaDe(grupo) !== pedido.uf
    ) {
      return;
    }
    const selecionado = municipioSelecionadoDe(grupo);
    const opcoes: MunicipioOpcao[] = result.ok
      ? [...result.data]
      : [...this.estadoDe(grupo).opcoes];
    if (selecionado && !opcoes.some((opcao) => opcao.codigoIbge === selecionado.codigoIbge)) {
      opcoes.unshift(selecionado);
    }
    this.definir(grupo, { opcoes, carregando: false, erro: !result.ok });
  }

  private estadoDe(grupo: GrupoDoDia): MunicipioBuscaState {
    return this.estados().get(grupo) ?? MUNICIPIO_BUSCA_VAZIA;
  }

  private definir(grupo: GrupoDoDia, estado: MunicipioBuscaState): void {
    this.estados.update((estados) => new Map(estados).set(grupo, estado));
  }
}
