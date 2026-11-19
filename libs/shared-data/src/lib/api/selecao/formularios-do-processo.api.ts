import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, VENDOR_MIME_TOKEN, withVendorMime } from '@uniplus/shared-core/http';
import type {
  AplicacaoDeModeloDto,
  AplicacaoDeModeloInput,
  DefinirFormularioRequest,
  DefinirItensDoFormularioRequest,
  DefinirReferenciaTemporalFatosRequest,
  DefinirTermosDoFormularioRequest,
  FormularioRenderizavelDto,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente dos formulários do processo seletivo e da referência temporal dos fatos que eles coletam. */
const MIME_DA_APLICACAO_DE_MODELO = {
  resource: 'aplicacao-de-modelo-formulario',
  version: 1,
} as const;

@Injectable({ providedIn: 'root' })
export class FormulariosDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/referencia-temporal-fatos` — declara o instante
   * contra o qual a idade do candidato é apurada.
   *
   * Uma política por certame, e ela ancora TODOS os gatilhos por idade dele. Exigida quando
   * alguma exigência condiciona por faixa etária: sem ela, a publicação é recusada, porque não
   * há fallback implícito para "quantos anos o candidato tinha". Enviar tudo nulo remove.
   *
   * Responde 204 sem corpo.
   */
  definirReferenciaTemporalFatos(
    processoSeletivoId: string,
    request: DefinirReferenciaTemporalFatosRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotas.doProcesso(processoSeletivoId, 'referencia-temporal-fatos'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/selecao/admin/processos-seletivos/{id}/formularios/{finalidade}` — cria ou
   * substitui o cabeçalho do formulário de uma finalidade (inscrição, isenção da taxa,
   * habilitação — ADR-0136): a fase em que é respondido, o título e as etapas. Na inscrição, a
   * API repõe a seção dos dados básicos.
   *
   * A leitura vem com o processo (`ProcessoSeletivoDto.formularios`). As escritas são três,
   * separadas porque a API confere cada parte contra o que está gravado da outra: o cabeçalho,
   * os itens e grupos, e os termos. O `If-Match` é aceito e ignorado no rascunho.
   *
   * Responde 204 sem corpo.
   */
  definirCabecalhoDoFormulario(
    processoSeletivoId: string,
    finalidade: string,
    request: DefinirFormularioRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.urlDoFormulario(processoSeletivoId, finalidade),
      request,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /**
   * PUT `…/formularios/{finalidade}/itens` — substitui os itens e os grupos; `grupos` nulo deixa
   * os grupos como estão. Exige o formulário criado. Responde 204 sem corpo.
   */
  definirItensDoFormulario(
    processoSeletivoId: string,
    finalidade: string,
    request: DefinirItensDoFormularioRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.urlDoFormulario(processoSeletivoId, finalidade)}/itens`,
      request,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /** PUT `…/formularios/{finalidade}/termos` — substitui os termos exigidos. Responde 204 sem corpo. */
  definirTermosDoFormulario(
    processoSeletivoId: string,
    finalidade: string,
    request: DefinirTermosDoFormularioRequest,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.urlDoFormulario(processoSeletivoId, finalidade)}/termos`,
      request,
      {
        context,
        headers: new HttpHeaders({ Accept: 'application/json' }),
      },
    );
  }

  /**
   * DELETE `…/formularios/{finalidade}` — só em rascunho; a inscrição é recusada se outra
   * finalidade cita fato dela. Responde 204 sem corpo.
   */
  removerFormulario(
    processoSeletivoId: string,
    finalidade: string,
    context?: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.urlDoFormulario(processoSeletivoId, finalidade), {
      context,
    });
  }

  /**
   * POST `…/formularios/aplicacoes-de-modelo` — copia o modelo para o processo: o formulário da
   * finalidade do modelo é criado ou substituído por inteiro, e a resposta relata o que a cópia
   * trouxe, manteve, descartou e derivou. Só em rascunho. A fase do formulário que já existia é
   * preservada; o que nasce pela aplicação fica sem fase até o cabeçalho declará-la.
   *
   * Responde com media type próprio, então o `Accept` é o do recurso; a Idempotency-Key vem do
   * `context` de quem chama.
   */
  aplicarModeloDeFormulario(
    processoSeletivoId: string,
    request: AplicacaoDeModeloInput,
    context: HttpContext,
  ): Observable<ApiResult<AplicacaoDeModeloDto>> {
    return this.http.post<ApiResult<AplicacaoDeModeloDto>>(
      this.urlDoFormulario(processoSeletivoId, 'aplicacoes-de-modelo'),
      request,
      { context: context.set(VENDOR_MIME_TOKEN, MIME_DA_APLICACAO_DE_MODELO) },
    );
  }

  /**
   * GET `/api/selecao/admin/processos-seletivos/{id}/formularios/{finalidade}/renderizavel` — o
   * formulário da finalidade pronto para o candidato ver, com as regras que o interpretador avalia,
   * montado da configuração viva: serve também ao rascunho, para a simulação.
   */
  obterFormularioRenderizavel(
    processoSeletivoId: string,
    finalidade: string,
  ): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.http.get<ApiResult<FormularioRenderizavelDto>>(
      `${this.urlDoFormulario(processoSeletivoId, finalidade)}/renderizavel`,
      {
        context: withVendorMime('formulario', 2),
      },
    );
  }

  private urlDoFormulario(processoSeletivoId: string, segmento: string): string {
    return this.rotas.doProcessoNaAdministracao(processoSeletivoId, 'formularios', segmento);
  }
}
