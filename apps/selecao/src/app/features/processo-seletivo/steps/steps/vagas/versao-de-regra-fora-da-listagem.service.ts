import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, STATUS_HTTP } from '@uniplus/shared-core/http';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';
import { Subscription } from 'rxjs';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogosDeDistribuicaoService } from './catalogos-de-distribuicao.service';

interface SelecaoDaRegra {
  readonly regraCodigo: string;
  readonly regraVersao: string;
}

type BuscaDaVersao =
  | { readonly estado: 'buscando'; readonly codigo: string; readonly versao: string }
  | {
      readonly estado: 'encontrada';
      readonly codigo: string;
      readonly versao: string;
      readonly regra: RegraCatalogoDto;
    }
  | { readonly estado: 'nao_encontrada'; readonly codigo: string; readonly versao: string }
  | { readonly estado: 'falha'; readonly codigo: string; readonly versao: string };

/**
 * A regra de remanejamento escolhida, inclusive quando a listagem ativa já não a traz.
 *
 * Hidratação (ou uma gravação anterior) pode referenciar uma regra que saiu da listagem desde
 * então (inativada, ou nova versão publicada por cima). A seleção é imutável por código e versão,
 * e item já referenciado permanece legível como snapshot: a busca é pela versão exata, nunca por
 * uma substituta.
 */
@Injectable()
export class VersaoDeRegraForaDaListagemService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeDistribuicaoService);
  private readonly regrasCatalogoApi = inject(RegrasCatalogoApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cascata = computed(() => this.store.draft().vagas.cascata);

  /** `null` enquanto não há por que buscar: seleção vazia, já na listagem ou catálogo carregando. */
  private readonly busca = signal<BuscaDaVersao | null>(null);

  /** A requisição por trás de um `buscando`, cancelada quando a seleção deixa de ser a dela. */
  private buscaEmCurso: Subscription | null = null;

  readonly regraEscolhida = computed<RegraCatalogoDto | undefined>(() => {
    const selecao = this.cascata();
    if (selecao === null) return undefined;

    const daListagem = this.catalogos
      .regrasCascata()
      .find(
        (regra) => regra.codigo === selecao.regraCodigo && regra.versao === selecao.regraVersao,
      );
    if (daListagem !== undefined) return daListagem;

    const busca = this.busca();
    return busca?.estado === 'encontrada' && this.ehDaSelecao(busca, selecao)
      ? busca.regra
      : undefined;
  });

  /**
   * A busca direta da versão terminou sem encontrá-la. `nao_encontrada` é reservado ao 404, a
   * única resposta que confirma que a regra não existe.
   */
  readonly regraNaoEncontrada = computed(() => this.terminouEm('nao_encontrada'));

  /**
   * A busca falhou por um motivo que não prova que a regra não existe (rede, 5xx, autorização).
   * É retentável por `tentarNovamente()`: a tela nunca declara a regra inexistente sem uma
   * resposta que confirme isso.
   */
  readonly falhaAoConsultarRegra = computed(() => this.terminouEm('falha'));

  constructor() {
    // Só depois de a listagem terminar de carregar, para ela ter prioridade e não disparar uma
    // busca que a própria listagem resolveria a seguir.
    effect(() => {
      const selecao = this.cascata();
      const carregando = this.catalogos.carregando();
      const regras = this.catalogos.regrasCascata();
      untracked(() => this.buscarSePreciso(selecao, carregando, regras));
    });
  }

  /** Limpa o estado anterior para que a falha não seja vista como "já tratada". */
  tentarNovamente(): void {
    this.busca.set(null);
    this.buscarSePreciso(
      this.cascata(),
      this.catalogos.carregando(),
      this.catalogos.regrasCascata(),
    );
  }

  private terminouEm(estado: 'nao_encontrada' | 'falha'): boolean {
    const selecao = this.cascata();
    const busca = this.busca();
    return selecao !== null && busca?.estado === estado && this.ehDaSelecao(busca, selecao);
  }

  private ehDaSelecao(busca: BuscaDaVersao, selecao: SelecaoDaRegra): boolean {
    return busca.codigo === selecao.regraCodigo && busca.versao === selecao.regraVersao;
  }

  private buscarSePreciso(
    selecao: SelecaoDaRegra | null,
    carregando: boolean,
    regras: readonly RegraCatalogoDto[],
  ): void {
    // Uma busca em curso cuja seleção saiu da tela (troca de processo, ou de regra) foi
    // abandonada: a resposta dela não completaria mais nada. Ela é cancelada e esquecida antes de
    // qualquer outra checagem, pois, se o `buscando` ficasse, voltar à mesma seleção o veria como
    // "já tratado" e nunca mais consultaria a versão.
    const emCurso = this.busca();
    if (
      emCurso?.estado === 'buscando' &&
      (selecao === null || !this.ehDaSelecao(emCurso, selecao))
    ) {
      this.buscaEmCurso?.unsubscribe();
      this.buscaEmCurso = null;
      this.busca.set(null);
    }

    if (selecao === null || carregando) return;

    const naListagem = regras.some(
      (regra) => regra.codigo === selecao.regraCodigo && regra.versao === selecao.regraVersao,
    );
    if (naListagem) return;

    const buscaAtual = this.busca();
    if (buscaAtual !== null && this.ehDaSelecao(buscaAtual, selecao)) return;

    const { regraCodigo: codigo, regraVersao: versao } = selecao;
    this.busca.set({ estado: 'buscando', codigo, versao });
    this.buscaEmCurso = this.regrasCatalogoApi
      .obterVersao(codigo, versao)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.buscaEmCurso = null;

        const atual = this.cascata();
        if (atual === null || atual.regraCodigo !== codigo || atual.regraVersao !== versao) return;

        if (isApiOk(resultado)) {
          this.busca.set({ estado: 'encontrada', codigo, versao, regra: resultado.data });
          return;
        }

        this.busca.set(
          resultado.problem.status === STATUS_HTTP.NAO_ENCONTRADO
            ? { estado: 'nao_encontrada', codigo, versao }
            : { estado: 'falha', codigo, versao },
        );
      });
  }
}
