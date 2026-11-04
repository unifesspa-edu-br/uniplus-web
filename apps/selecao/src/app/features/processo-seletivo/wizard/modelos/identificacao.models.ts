import type { OrigemCandidatos } from '@uniplus/shared-data/selecao';

/**
 * Origem dos candidatos no rascunho: `''` é "ainda não escolhida". `OrigemCandidatos.nenhuma`
 * existe no contrato, mas a criação a recusa, então não é oferecida.
 */
export type OrigemCandidatosSelecionada =
  | ''
  | OrigemCandidatos.inscricaoPropria
  | OrigemCandidatos.importacaoExterna;

/**
 * Fase do anexo do edital, na ordem em que a API a executa: registro com URL pré-assinada
 * (`iniciando`), arquivo direto ao storage (`enviando`) e leitura do objeto para validar e selar
 * (`confirmando`). Guardar a fase permite retomar do ponto certo depois de uma falha.
 */
export type FaseUpload = 'iniciando' | 'enviando' | 'confirmando' | 'confirmado' | 'erro';

export interface UploadItem {
  id: string;
  name: string;
  /** O contrato do documento do edital aceita somente PDF. */
  extension: 'pdf';
  progress: number;
  fase: FaseUpload;
  /** Id do registro criado na iniciação — necessário para confirmar. */
  documentoAPublicarId?: string;
  /** Instante em que a URL pré-assinada deixa de valer. */
  expiraEm?: string;
  /**
   * O arquivo já chegou ao storage. No caso "subiu e a confirmação não concluiu", repetir o PUT
   * é desperdício e pode esbarrar na URL expirada; repetir só a confirmação recupera o replay.
   */
  enviado?: boolean;
  /**
   * A confirmação ficou sem resposta definitiva e o documento pode já estar selado e imutável:
   * trocar o arquivo criaria um segundo edital, então só a retentativa da mesma confirmação resolve.
   */
  confirmacaoIndefinida?: boolean;
  mensagemErro?: string;
}

/**
 * Um anexo do edital no rascunho da publicação. Segue as fases do documento do edital, e só o
 * confirmado entra na publicação, porque é imutável e é o que o edital atesta.
 */
export interface AnexoDoEdital extends Omit<UploadItem, 'extension' | 'name'> {
  /** O arquivo como o operador o escolheu; identifica o anexo na lista de envio. */
  nomeArquivo: string;
  /** O nome com que a pessoa recebe o anexo no download, editável até publicar. */
  nome: string;
}

/**
 * Snapshot da cidade escolhida no seletor da Geo. Os três campos viajam juntos porque o backend
 * valida a coerência do trio; `nome` e `uf` são cache de exibição e não entram em cálculo de prazo.
 */
export interface LocalidadeSelecionada {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}
