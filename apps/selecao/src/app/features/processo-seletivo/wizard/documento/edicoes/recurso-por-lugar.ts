import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoPropriedadesDoRecurso,
  DocumentoDaConfiguracaoRecursoDaEtapa,
} from '@uniplus/shared-data/selecao';

import { naEtapa } from './na-etapa';
import { naFase } from './fases-do-cronograma.edicao';
import { editarOcorrenciaDaEtapa, editarOcorrenciaDaFase } from './ocorrencia-da-fase-ou-etapa';
import { comCampo, comLista } from './secao-do-documento';

type AlteracaoDaRegra = (
  regra: DocumentoDaConfiguracaoPropriedadesDoRecurso,
) => DocumentoDaConfiguracaoPropriedadesDoRecurso;
type AlteracaoDoRecurso = (
  recurso: DocumentoDaConfiguracaoRecursoDaEtapa,
) => DocumentoDaConfiguracaoRecursoDaEtapa;

/**
 * Edita a regra de recurso da fase. A presença da regra é o que faz a fase admitir recurso: fase
 * sem regra não ganha uma aqui, e a edição não muda nada.
 */
export function naRegraDeRecursoDaFase(
  documento: DocumentoDaConfiguracao,
  faseChave: string,
  alterar: AlteracaoDaRegra,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return editarOcorrenciaDaFase(documento, faseChave, ocorrencia, (isolado) =>
    naFase(isolado, faseChave, (fase) =>
      fase.regraRecurso === undefined
        ? fase
        : comCampo(fase, 'regraRecurso', alterar(fase.regraRecurso)),
    ),
  );
}

/**
 * Edita o recurso da etapa que está na posição. O recurso não tem chave: a posição na lista da
 * etapa o identifica, e posição que não existe não muda nada.
 */
export function noRecursoDaEtapa(
  documento: DocumentoDaConfiguracao,
  etapaChave: string,
  lugar: number | { readonly posicao: number; readonly ocorrencia: number },
  alterar: AlteracaoDoRecurso,
): DocumentoDaConfiguracao {
  const posicao = typeof lugar === 'number' ? lugar : lugar.posicao;
  const ocorrencia = typeof lugar === 'number' ? 0 : lugar.ocorrencia;
  return editarOcorrenciaDaEtapa(documento, etapaChave, ocorrencia, (isolado) =>
    naEtapa(isolado, etapaChave, (etapa) =>
      comLista(etapa, 'recursos', naPosicao(etapa.recursos ?? [], posicao, alterar)),
    ),
  );
}

function naPosicao<T>(itens: readonly T[], posicao: number, alterar: (item: T) => T): readonly T[] {
  return itens.map((item, indice) => (indice === posicao ? alterar(item) : item));
}
