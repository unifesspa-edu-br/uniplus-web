import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import { VocabulariosDaDeliberacaoApi } from './vocabularios-da-deliberacao.api';
import {
  FinalidadeDoDocumentoCodigo,
  SentidoDoMotivoCodigo,
  StatusArquivoEnviadoCodigo,
  StatusProcessoCodigo,
  TipoRegraCodigo,
} from './schema';

export const situacaoDoProcesso = {
  codigo: StatusProcessoCodigo.RASCUNHO,
  rotulo: 'Em preparação',
};
export const arquivoConfirmado = {
  codigo: StatusArquivoEnviadoCodigo.CONFIRMADO,
  rotulo: 'Confirmado',
};
export const arquivoPendente = { codigo: StatusArquivoEnviadoCodigo.PENDENTE, rotulo: 'Pendente' };
export const sentidoDesfavoravel = {
  codigo: SentidoDoMotivoCodigo.DESFAVORAVEL,
  rotulo: 'Desfavorável',
};
export const tipoDeRegra = {
  codigo: TipoRegraCodigo.REGRA_DISTRIBUICAO_VAGAS,
  rotulo: 'Distribuição de vagas',
};
export const finalidadeDoDocumento = {
  codigo: FinalidadeDoDocumentoCodigo.DOCUMENTO_DO_EDITAL,
  rotulo: 'Documento do edital',
};

export function proverVocabulariosDaDeliberacao() {
  const resposta = () => of(apiOk([], 200, new HttpHeaders()));
  return {
    provide: VocabulariosDaDeliberacaoApi,
    useValue: {
      listarModosDeDeliberacao: resposta,
      listarCriteriosDeVotacao: resposta,
      listarDesempatesDaVotacao: resposta,
      listarEncerramentosDaVotacao: resposta,
      listarResultadosSemUnanimidade: resposta,
    },
  };
}
