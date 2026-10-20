import type { Observable } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import type {
  AvaliacaoDaInscricaoDto,
  AvaliacaoDaInscricaoRequest,
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  InscricaoDto,
  InscricaoRequest,
} from '@uniplus/shared-data/selecao';

/**
 * O que a tela de inscrição pede ao módulo Seleção. A tela não fala HTTP: quem a provê decide a
 * implementação.
 */
export abstract class InscricaoDoCandidatoService {
  /** A inscrição do candidato no processo: a existente, ou o rascunho que nasce agora. */
  abstract iniciar(processoId: string): Observable<ApiResult<InscricaoDto>>;
  /** A inscrição como está gravada agora, com o ETag da revisão corrente. */
  abstract obter(processoId: string): Observable<ApiResult<InscricaoDto>>;
  /** O formulário da versão em que está a inscrição: no rascunho, a vigente. */
  abstract obterFormulario(processoId: string): Observable<ApiResult<FormularioRenderizavelDto>>;
  abstract salvar(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<InscricaoDto>>;
  /** O que as respostas determinam agora, sem gravar: as do corpo valem sobre as gravadas. */
  abstract avaliar(
    processoId: string,
    request: AvaliacaoDaInscricaoRequest,
  ): Observable<ApiResult<AvaliacaoDaInscricaoDto>>;
  abstract submeter(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<ComprovanteInscricaoDto>>;
}
