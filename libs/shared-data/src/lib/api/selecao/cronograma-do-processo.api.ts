import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type {
  DefinirAlgoritmoContagemPrazoRequest,
  EtapaProcessoInput,
  FaseCronogramaInput,
  RegraDeComprovacaoInformada,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente das etapas, das fases do cronograma, dos documentos exigidos e do algoritmo de contagem de prazo. */
@Injectable({ providedIn: 'root' })
export class CronogramaDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/etapas` — substitui a coleção
   * inteira de etapas pontuadas.
   *
   * Enviar menos etapas do que existem remove as ausentes, e é assim que uma
   * etapa sai da configuração. Coleção vazia é estado válido: processo sem
   * prova — classificação importada — não tem etapa pontuada, e o servidor a
   * aceita sem inventar nenhuma.
   *
   * O `id` de cada item é opcional e **deve ser reenviado** quando a etapa já
   * existe: é ele que critério de desempate e regra de eliminação referenciam,
   * e omiti-lo faria o servidor criar outra etapa, deixando as referências
   * apontando para uma que deixou de existir.
   *
   * Responde 204 sem corpo.
   */
  definirEtapas(
    processoSeletivoId: string,
    etapas: readonly EtapaProcessoInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'etapas'),
      etapas,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/cronograma-fases` — substitui o
   * cronograma inteiro.
   *
   * A janela de cada fase é **instante**, não data: o servidor normaliza para
   * UTC preservando o momento, e o deslocamento com que o cliente escreve é
   * transporte. Enviar só a data perderia a hora que separa "encerra dia 20" de
   * "encerra 20/03 às 23:59:59".
   *
   * Não há campo de `id` na entrada — a reconciliação do servidor é por
   * `faseCanonicaId`, que é a identidade estável de uma fase no cronograma.
   *
   * Responde 204 sem corpo.
   */
  definirCronogramaFases(
    processoSeletivoId: string,
    fases: readonly FaseCronogramaInput[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'cronograma-fases'),
      fases,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** Substitui todas as regras de comprovação documental e retorna 204 sem corpo. */
  definirDocumentosExigidos(
    processoSeletivoId: string,
    regrasDeComprovacao: readonly RegraDeComprovacaoInformada[],
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'documentos-exigidos'),
      regrasDeComprovacao,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/algoritmo-contagem-prazo` —
   * declara a convenção de contagem que o certame usa nos prazos que distinguem
   * dia útil, por código e versão do catálogo de regras.
   *
   * **Não aceita limpar a declaração.** Código ou versão nulos são recusados
   * com 422, ainda que o contrato tipe os dois como anuláveis — não existe
   * "desmarcar" a convenção, só trocá-la. Quem chama só dispara depois de haver
   * escolha.
   *
   * Responde 204 sem corpo.
   */
  definirAlgoritmoContagemPrazo(
    processoSeletivoId: string,
    request: DefinirAlgoritmoContagemPrazoRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'algoritmo-contagem-prazo'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
