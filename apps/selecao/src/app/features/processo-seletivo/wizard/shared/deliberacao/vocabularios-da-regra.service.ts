import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { type ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

export interface OpcaoDaRegra {
  readonly codigo: string;
  readonly rotulo: string;
}

type EstadoDaLista =
  | { readonly situacao: 'carregando' | 'indisponivel'; readonly opcoes: readonly OpcaoDaRegra[] }
  | { readonly situacao: 'pronta'; readonly opcoes: readonly OpcaoDaRegra[] };

function estadoDaResposta(resposta: ApiResult<readonly OpcaoDaRegra[]>): EstadoDaLista {
  return resposta.ok
    ? { situacao: 'pronta', opcoes: resposta.data }
    : { situacao: 'indisponivel', opcoes: [] };
}

@Injectable({ providedIn: 'root' })
export class VocabulariosDaRegra {
  private readonly http = inject(HttpClient);
  private readonly base = inject(SELECAO_BASE_PATH);
  readonly modos = this.ler('modos-deliberacao', 'modo-deliberacao');
  readonly criterios = this.ler('criterios-votacao', 'criterio-votacao');
  readonly desempates = this.ler('desempates-votacao', 'desempate-votacao');
  readonly encerramentos = this.ler('encerramentos-votacao', 'encerramento-votacao');
  readonly resultados = this.ler('resultados-sem-unanimidade', 'resultado-sem-unanimidade');
  readonly pronta = computed(() => this.listas().every((lista) => lista.situacao === 'pronta'));
  readonly indisponivel = computed(() =>
    this.listas().some((lista) => lista.situacao === 'indisponivel'),
  );

  opcao(campo: string, codigo: string): OpcaoDaRegra | undefined {
    const listas: Record<string, readonly OpcaoDaRegra[]> = {
      modo: this.modos().opcoes,
      criterio: this.criterios().opcoes,
      desempate: this.desempates().opcoes,
      encerramento: this.encerramentos().opcoes,
      semUnanimidade: this.resultados().opcoes,
    };
    return listas[campo]?.find((opcao) => opcao.codigo === codigo);
  }

  private listas(): readonly EstadoDaLista[] {
    return [
      this.modos(),
      this.criterios(),
      this.desempates(),
      this.encerramentos(),
      this.resultados(),
    ];
  }

  private ler(caminho: string, recurso: string) {
    const estado = signal<EstadoDaLista>({ situacao: 'carregando', opcoes: [] });
    this.http
      .get<
        ApiResult<readonly OpcaoDaRegra[]>
      >(`${this.base}/api/selecao/vocabularios/${caminho}`, { context: withVendorMime(recurso, 1) })
      .subscribe({
        next: (resposta) => estado.set(estadoDaResposta(resposta)),
        error: () => estado.set({ situacao: 'indisponivel', opcoes: [] }),
      });
    return estado.asReadonly();
  }
}
