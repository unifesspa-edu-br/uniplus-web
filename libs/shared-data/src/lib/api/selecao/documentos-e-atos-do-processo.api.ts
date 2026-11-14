import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type {
  AcessoDocumentoAPublicarDto,
  AcessoModeloDeDocumentoDto,
  AtoDoProcessoDto,
  AtoPublicadoDto,
  CampoDivulgacaoDto,
  DocumentoAPublicarDto,
  FinalidadeDoDocumento,
  IniciarEnvioDoDocumentoAPublicarDto,
  IniciarEnvioDoDocumentoAPublicarRequest,
  IniciarEnvioDoModeloDeDocumentoDto,
  IniciarEnvioDoModeloDeDocumentoRequest,
  ModeloDeDocumentoDto,
  ProdutosPrevistosDoProcessoDto,
  PublicarAtoAvulsoDoProcessoRequest,
  PublicarProdutoDoEditalRequest,
} from './processos-seletivos.contrato';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

/** Cliente dos documentos a publicar, dos atos e dos modelos de documento do processo seletivo. */
@Injectable({ providedIn: 'root' })
export class DocumentosEAtosDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * GET `/api/selecao/processos-seletivos/{id}/documentos-a-publicar` — todos os
   * documentos a publicar registrados no processo, pendentes e confirmados.
   *
   * É a leitura que permite retomar o anexo depois de um refresh: o cliente
   * não guarda o `documentoAPublicarId` nem a URL assinada, então é daqui que o
   * editor descobre o que já existe. Havendo mais de um documento confirmado,
   * a escolha do oficial é do administrador — `criadoEm` e `confirmadoEm`
   * servem para apresentá-los, não para o frontend eleger o mais recente.
   *
   * `finalidade` restringe a coleção a um tipo de documento. A escolha do edital oficial pede só
   * `documentoDoEdital`: os anexos do edital vivem na mesma coleção e não são candidatos a oficial.
   *
   * A coleção não é paginada: um processo tem poucos documentos por natureza.
   */
  listarDocumentosAPublicar(
    processoSeletivoId: string,
    finalidade?: FinalidadeDoDocumento,
  ): Observable<ApiResult<readonly DocumentoAPublicarDto[]>> {
    const params =
      finalidade === undefined ? new HttpParams() : new HttpParams().set('finalidade', finalidade);
    return this.http.get<ApiResult<readonly DocumentoAPublicarDto[]>>(
      this.rotas.doProcesso(processoSeletivoId, 'documentos-a-publicar'),
      { params, context: withVendorMime('documento-a-publicar', 1) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/atos` — os atos do processo, do mais recente ao
   * mais antigo, cada um com o documento principal e os anexos que publicou. É daqui que a tela lê
   * os anexos do edital da versão vigente, já que o ato guarda o que a versão congelou.
   */
  listarAtosDoProcesso(
    processoSeletivoId: string,
  ): Observable<ApiResult<readonly AtoDoProcessoDto[]>> {
    return this.http.get<ApiResult<readonly AtoDoProcessoDto[]>>(
      this.rotas.doProcesso(processoSeletivoId, 'atos'),
      { context: withVendorMime('ato-do-processo', 1) },
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/atos` — publica um documento avulso do processo
   * (aviso, comunicado, errata), com o documento principal e os anexos já enviados, e a correção de
   * um ato publicado quando o corpo cita `atoCorrigidoId` e o motivo.
   *
   * Responde 202: o ato fica pendente até o registro central confirmar. As recusas de negócio
   * (processo sem página pública, tipo que não serve a documento avulso, ato já corrigido,
   * documento já usado) chegam como `ApiResult.fail` com o `ProblemDetails` do 422.
   */
  publicarAtoAvulso(
    processoSeletivoId: string,
    request: PublicarAtoAvulsoDoProcessoRequest,
    context: HttpContext,
  ): Observable<ApiResult<AtoPublicadoDto>> {
    return this.http.post<ApiResult<AtoPublicadoDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'atos'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/produtos-previstos` — os atos que o cronograma da
   * versão vigente declara publicar, por fase e etapa, cada um com a situação, as correções e o
   * que o impede de sair agora. Traz também a política de divulgação do certame, a da versão
   * vigente.
   */
  obterProdutosPrevistos(
    processoSeletivoId: string,
  ): Observable<ApiResult<ProdutosPrevistosDoProcessoDto>> {
    return this.http.get<ApiResult<ProdutosPrevistosDoProcessoDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'produtos-previstos'),
      { context: withVendorMime('produtos-previstos-do-processo', 1) },
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/produtos-previstos/{produtoId}/publicacoes` —
   * publica um item que o edital declara, ou a correção de uma publicação dele quando o corpo cita
   * `atoCorrigidoId` e o motivo. O tipo do ato vem do item; no resultado, o corpo leva a
   * confirmação da política de divulgação.
   *
   * Responde 202: o ato fica pendente até o registro central confirmar. As recusas de negócio
   * (item já publicado, definitivo antes do preliminar, política não confirmada) chegam como
   * `ApiResult.fail` com o `ProblemDetails` do 422.
   */
  publicarProdutoPrevisto(
    processoSeletivoId: string,
    produtoId: string,
    request: PublicarProdutoDoEditalRequest,
    context: HttpContext,
  ): Observable<ApiResult<AtoPublicadoDto>> {
    return this.http.post<ApiResult<AtoPublicadoDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'produtos-previstos', produtoId, 'publicacoes'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * GET `/api/selecao/campos-divulgacao` — os campos que a política de divulgação pode tornar
   * públicos, com o nome para exibição. A política do certame cita os campos só pelo código.
   */
  listarCamposDivulgacao(): Observable<ApiResult<readonly CampoDivulgacaoDto[]>> {
    return this.http.get<ApiResult<readonly CampoDivulgacaoDto[]>>(
      this.rotas.doCatalogo('campos-divulgacao'),
      { context: withVendorMime('campo-divulgacao', 1) },
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/documentos-a-publicar/{docId}/acesso`
   * — pede o acesso de leitura a um documento confirmado, para conferir o PDF
   * anexado.
   *
   * A URL vem assinada e com validade curta, e é emitida a cada chamada: o
   * servidor não a distribui na listagem justamente para que o prazo comece
   * quando o acesso é pedido. Pelo mesmo motivo ela não é guardada aqui — quem
   * a tem abre o arquivo sem passar por autorização de novo.
   */
  obterAcessoDocumentoAPublicar(
    processoSeletivoId: string,
    documentoAPublicarId: string,
  ): Observable<ApiResult<AcessoDocumentoAPublicarDto>> {
    return this.http.get<ApiResult<AcessoDocumentoAPublicarDto>>(
      this.rotas.doProcesso(
        processoSeletivoId,
        'documentos-a-publicar',
        documentoAPublicarId,
        'acesso',
      ),
      { context: withVendorMime('acesso-documento-a-publicar', 1) },
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/documentos-a-publicar` — primeiro
   * dos três passos do envio de um documento a publicar: cria o registro
   * pendente com o nome do arquivo e o tipo de mídia declarados e devolve a
   * URL pré-assinada de PUT, o content type que a assinatura exige e o
   * instante em que ela expira.
   */
  iniciarEnvioDocumentoAPublicar(
    processoSeletivoId: string,
    request: IniciarEnvioDoDocumentoAPublicarRequest,
    context: HttpContext,
  ): Observable<ApiResult<IniciarEnvioDoDocumentoAPublicarDto>> {
    return this.http.post<ApiResult<IniciarEnvioDoDocumentoAPublicarDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'documentos-a-publicar'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * Terceiro passo: a API lê o objeto no storage, confere content type,
   * tamanho e assinatura de arquivo, calcula o hash e sela o documento como
   * imutável. Também não recebe corpo.
   *
   * O segundo passo — o PUT na URL pré-assinada — não é rota do Uni+ e não
   * devolve `ApiResult`: fica no `SignedUploadClient` de `shared-core/http`.
   */
  confirmarEnvioDocumentoAPublicar(
    processoSeletivoId: string,
    documentoAPublicarId: string,
    context: HttpContext,
  ): Observable<ApiResult<DocumentoAPublicarDto>> {
    return this.confirmarEnvio<DocumentoAPublicarDto>(
      processoSeletivoId,
      'documentos-a-publicar',
      documentoAPublicarId,
      context,
    );
  }

  /**
   * POST `/api/selecao/processos-seletivos/{id}/modelos-de-documento` — primeiro dos três passos
   * do envio do modelo de documento que uma exigência oferece ao candidato: cria o modelo pendente
   * com o nome que o candidato recebe no download e o formato editável (`DOCX` ou `ODT`), e
   * devolve a URL pré-assinada de PUT, o content type que ela exige e o instante em que expira.
   */
  iniciarEnvioModeloDeDocumento(
    processoSeletivoId: string,
    request: IniciarEnvioDoModeloDeDocumentoRequest,
    context: HttpContext,
  ): Observable<ApiResult<IniciarEnvioDoModeloDeDocumentoDto>> {
    return this.http.post<ApiResult<IniciarEnvioDoModeloDeDocumentoDto>>(
      this.rotas.doProcesso(processoSeletivoId, 'modelos-de-documento'),
      request,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * Terceiro passo: a API lê o arquivo no storage, confere que é documento de texto do formato
   * declarado e sem macro, calcula o hash e sela o modelo como imutável. Não recebe corpo.
   */
  confirmarEnvioModeloDeDocumento(
    processoSeletivoId: string,
    modeloDeDocumentoId: string,
    context: HttpContext,
  ): Observable<ApiResult<ModeloDeDocumentoDto>> {
    return this.confirmarEnvio<ModeloDeDocumentoDto>(
      processoSeletivoId,
      'modelos-de-documento',
      modeloDeDocumentoId,
      context,
    );
  }

  /**
   * GET `/api/selecao/processos-seletivos/{id}/modelos-de-documento/{modeloId}/acesso` — o acesso
   * de leitura a um modelo confirmado, para conferi-lo antes da publicação. A URL vem assinada,
   * com validade curta e emitida a cada chamada, pela mesma razão do acesso ao edital.
   */
  obterAcessoModeloDeDocumento(
    processoSeletivoId: string,
    modeloDeDocumentoId: string,
  ): Observable<ApiResult<AcessoModeloDeDocumentoDto>> {
    return this.http.get<ApiResult<AcessoModeloDeDocumentoDto>>(
      this.rotas.doProcesso(
        processoSeletivoId,
        'modelos-de-documento',
        modeloDeDocumentoId,
        'acesso',
      ),
      { context: withVendorMime('acesso-modelo-de-documento', 1) },
    );
  }

  /** O terceiro passo do envio é o mesmo nos dois arquivos: um POST sem corpo na `confirmacao`. */
  private confirmarEnvio<T>(
    processoSeletivoId: string,
    colecao: string,
    arquivoId: string,
    context: HttpContext,
  ): Observable<ApiResult<T>> {
    return this.http.post<ApiResult<T>>(
      this.rotas.doProcesso(processoSeletivoId, colecao, arquivoId, 'confirmacao'),
      null,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }
}
