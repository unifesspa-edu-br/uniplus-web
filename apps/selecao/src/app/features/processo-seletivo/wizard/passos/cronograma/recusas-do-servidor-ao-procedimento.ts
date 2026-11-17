import { paginaDoErro, type ProblemDetails } from '@uniplus/shared-core/http';
import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoProcedimentoDeRecurso,
  RascunhoSubstituidoResponse,
} from '@uniplus/shared-data/selecao';

import { alvoDoProcedimento } from '../../documento/edicoes/procedimentos-de-recurso.edicao';
import { segmentosDoPonteiro } from '../../documento/ponteiro/segmentos-do-ponteiro';
import { mesmoAlvo } from '../../shared/procedimentos-do-recurso/unicidade-dos-procedimentos';
import type { RecusaDoProcedimento } from './procedimentos-do-recurso/recusas-do-procedimento';
import { textoDaRecusaDoProcedimento } from './procedimentos-do-recurso/textos-das-recusas-do-procedimento';

type RespostaDoServidor =
  | Pick<ProblemDetails, 'type' | 'code' | 'errors'>
  | Pick<RascunhoSubstituidoResponse, 'diagnosticos'>;
type Causa = RascunhoSubstituidoResponse['diagnosticos'][number];
type Procedimento = DocumentoDaConfiguracaoProcedimentoDeRecurso;
type Destino = Omit<RecusaDoProcedimento, 'recusa'>;

const INDICE = /^(0|[1-9]\d*)$/;
const CAMPOS_DO_PROCEDIMENTO = new Set(
  [
    [],
    ['tipoDeDecisao'],
    ['regra'],
    ['regra', 'codigo'],
    ['regra', 'versao'],
    ['alvo'],
    ['alvo', 'itemDeAvaliacaoChave'],
    ['alvo', 'areaDoEnem'],
  ].map((campo) => JSON.stringify(campo)),
);

function identidadeNaPosicao(enviados: readonly Procedimento[], posicao: number): Destino | null {
  const procedimento = enviados[posicao];
  if (procedimento === undefined) return null;
  const { tipoDeDecisao } = procedimento;
  const alvo = alvoDoProcedimento(procedimento.alvo);
  const ocorrencia = enviados
    .slice(0, posicao)
    .filter(
      (anterior) => anterior.tipoDeDecisao === tipoDeDecisao && mesmoAlvo(anterior.alvo, alvo),
    ).length;
  return { tipoDeDecisao, alvo, ...(ocorrencia > 0 && { ocorrencia }) };
}

function destinoNoProcedimento(
  segmentos: readonly string[],
  enviados: readonly Procedimento[],
): Destino | null {
  const [lista, indice, ...campo] = segmentos;
  if (lista !== 'procedimentosDeRecurso' || !INDICE.test(indice ?? '')) return null;
  if (!CAMPOS_DO_PROCEDIMENTO.has(JSON.stringify(campo))) return null;
  return identidadeNaPosicao(enviados, Number(indice));
}

function destinoDaRecusa(
  caminho: string,
  janela: readonly string[],
  enviados: readonly Procedimento[],
): Destino | null {
  const leitura = segmentosDoPonteiro(caminho);
  if (!leitura.lido || !janela.every((parte, indice) => leitura.segmentos[indice] === parte))
    return null;
  const restante = leitura.segmentos.slice(janela.length);
  const apontaJanela =
    restante.length === 0 || (restante.length === 1 && restante[0] === 'procedimentosDeRecurso');
  if (apontaJanela) return { tipoDeDecisao: null, alvo: null, semLinha: true };
  return destinoNoProcedimento(restante, enviados);
}

function recusaDaCausa(
  resposta: RespostaDoServidor,
  causa: Causa,
  janela: readonly string[],
  enviados: readonly Procedimento[],
): readonly RecusaDoProcedimento[] {
  const mensagem = textoDaRecusaDoProcedimento(causa.code);
  const destino = causa.field == null ? null : destinoDaRecusa(causa.field, janela, enviados);
  if (mensagem === null || destino === null) return [];
  const pagina = 'type' in resposta ? paginaDoErro(resposta, causa.code) : null;
  const semLinha = causa.code.endsWith('.procedimento_de_recurso_ausente') || destino.semLinha;
  const recusa = { codigo: causa.code, mensagem, pagina };
  return [{ ...destino, ...(semLinha && { semLinha }), recusa }];
}

function recusasDaJanela(
  resposta: RespostaDoServidor,
  janela: readonly string[],
  enviados: readonly Procedimento[],
): readonly RecusaDoProcedimento[] {
  const causas = 'diagnosticos' in resposta ? resposta.diagnosticos : (resposta.errors ?? []);
  return causas.flatMap((causa) => recusaDaCausa(resposta, causa, janela, enviados));
}

/** Resolve o diagnóstico no documento enviado, antes de qualquer reordenação da edição atual. */
export function recusasDosProcedimentosDaFase(
  resposta: RespostaDoServidor,
  indiceDaFase: number,
  documentoEnviado: DocumentoDaConfiguracao,
): readonly RecusaDoProcedimento[] {
  const fase = documentoEnviado.cronograma?.fases?.[indiceDaFase];
  if (fase === undefined) return [];
  return recusasDaJanela(
    resposta,
    ['cronograma', 'fases', String(indiceDaFase), 'regraRecurso'],
    fase.regraRecurso?.procedimentosDeRecurso ?? [],
  );
}

/** A posição identifica a janela da etapa, que não tem chave própria no documento. */
export function recusasDosProcedimentosDaEtapa(
  resposta: RespostaDoServidor,
  indiceDaEtapa: number,
  indiceDaJanela: number,
  documentoEnviado: DocumentoDaConfiguracao,
): readonly RecusaDoProcedimento[] {
  const recurso = documentoEnviado.etapas?.[indiceDaEtapa]?.recursos?.[indiceDaJanela];
  if (recurso === undefined) return [];
  return recusasDaJanela(
    resposta,
    ['etapas', String(indiceDaEtapa), 'recursos', String(indiceDaJanela)],
    recurso.procedimentosDeRecurso ?? [],
  );
}
