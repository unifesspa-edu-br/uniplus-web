import type { Observable } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  InscricaoDto,
  InscricaoRequest,
} from '@uniplus/shared-data/selecao';

/** Uma oferta de curso que o candidato escolhe na inscrição; o nome falta quando o processo não o publica. */
export interface OfertaDaInscricao {
  readonly id: string;
  readonly nome: string | null;
}

/**
 * O que a tela de inscrição pede ao módulo Seleção. A tela não fala HTTP: quem a provê decide a
 * implementação.
 */
export abstract class InscricaoDoCandidatoService {
  /** A inscrição do candidato no processo: a existente, ou o rascunho que nasce agora. */
  abstract iniciar(processoId: string): Observable<ApiResult<InscricaoDto>>;
  /** A inscrição como está gravada agora, com o ETag da revisão corrente. */
  abstract obter(processoId: string): Observable<ApiResult<InscricaoDto>>;
  /** O formulário da versão que a inscrição fixou ao nascer. */
  abstract obterFormulario(processoId: string): Observable<ApiResult<FormularioRenderizavelDto>>;
  abstract obterOfertas(processoId: string): Observable<ApiResult<readonly OfertaDaInscricao[]>>;
  abstract salvar(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<InscricaoDto>>;
  abstract submeter(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<ComprovanteInscricaoDto>>;
}
