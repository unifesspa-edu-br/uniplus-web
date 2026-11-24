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
  codigo: StatusProcessoCodigo.rascunho,
  rotulo: 'Em preparação',
};
export const arquivoConfirmado = {
  codigo: StatusArquivoEnviadoCodigo.Confirmado,
  rotulo: 'Confirmado',
};
export const arquivoPendente = { codigo: StatusArquivoEnviadoCodigo.Pendente, rotulo: 'Pendente' };
export const sentidoDesfavoravel = {
  codigo: SentidoDoMotivoCodigo.DESFAVORAVEL,
  rotulo: 'Desfavorável',
};
export const tipoDeRegra = {
  codigo: TipoRegraCodigo.regra_distribuicao_vagas,
  rotulo: 'Distribuição de vagas',
};
export const finalidadeDoDocumento = {
  codigo: FinalidadeDoDocumentoCodigo.documentoDoEdital,
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
