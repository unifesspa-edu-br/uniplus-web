export interface AuthConfig {
  issuerUrl: string;
  clientId: string;
  /**
   * Lista de URLs (prefixos de origem) para as quais o `tokenInterceptor`
   * pode anexar o header `Authorization: Bearer`. Ex.: URL da API do
   * back-end e URL do provedor OIDC. Requisições para qualquer outro
   * destino são enviadas sem Bearer.
   *
   * Sempre que o consumidor não configurar explicitamente, o interceptor
   * se comporta de forma conservadora (nenhum Bearer é anexado).
   */
  allowedUrls: readonly string[];
  /**
   * Quantos segundos antes de vencer o acesso é renovado. Vale para a renovação antecipada e para
   * a conferência que o `tokenInterceptor` faz antes de cada pedido.
   */
  antecedenciaDaRenovacaoEmSegundos: number;
  /**
   * Período máximo da sessão no provedor, em segundos: o mesmo valor do realm. Por ele a aplicação
   * reconhece, desde a primeira leitura, que o fim da sessão não se estende renovando.
   */
  periodoMaximoDaSessaoEmSegundos: number;
}
