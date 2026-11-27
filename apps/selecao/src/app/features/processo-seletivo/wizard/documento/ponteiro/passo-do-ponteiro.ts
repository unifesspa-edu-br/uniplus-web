import type { RotuloDePasso } from '../../processo-seletivo.data';
import { segmentosDoPonteiro } from './segmentos-do-ponteiro';

/** A área do cronograma que abre quando o ponteiro aponta o detalhe de uma fase ou etapa. */
export type DetalheDoCronograma = 'fase' | 'etapa' | 'documentos' | 'decisoes';

/**
 * Onde a pendência se resolve. Parte do documento sem tela (`provaPresencial`, `importacao`,
 * `divulgacao`) pede orientação textual; ponteiro que não se reconhece é causa geral.
 */
export type DestinoDoPonteiro =
  | { readonly passo: RotuloDePasso; readonly detalhe?: DetalheDoCronograma }
  | { readonly passo: null; readonly motivo: 'documentoSemTela' | 'foraDoMapa' };

type Resolucao = (campo: string | undefined) => DestinoDoPonteiro;

const FORA_DO_MAPA: DestinoDoPonteiro = { passo: null, motivo: 'foraDoMapa' };
const SEM_TELA: DestinoDoPonteiro = { passo: null, motivo: 'documentoSemTela' };

function noPasso(passo: RotuloDePasso, detalhe?: DetalheDoCronograma): Resolucao {
  return () => (detalhe === undefined ? { passo } : { passo, detalhe });
}

/** O tipo do processo e a contagem de prazos moram em `/identificacao`, mas têm passo próprio. */
const doBlocoDaIdentificacao: Resolucao = (campo) => {
  if (campo?.startsWith('tipoProcesso')) return { passo: 'Tipo do processo' };
  return { passo: campo === 'algoritmoContagemPrazo' ? 'Cronograma' : 'Identificação' };
};

/** Eliminação e desempate são listas de `/classificacao`; o resto dela é a fórmula. */
const doBlocoDaClassificacao: Resolucao = (campo) => {
  if (campo === 'regrasEliminacao') return { passo: 'Eliminação' };
  if (campo === 'criteriosDeDesempate') return { passo: 'Desempate' };
  return { passo: 'Fórmula e precisão' };
};

const doBlocoDoCronograma: Resolucao = (campo) =>
  campo === 'fases' ? { passo: 'Cronograma', detalhe: 'fase' } : { passo: 'Cronograma' };

const RESOLUCAO_POR_SECAO: ReadonlyMap<string, Resolucao> = new Map<string, Resolucao>([
  ['identificacao', doBlocoDaIdentificacao],
  ['taxaDeInscricao', noPasso('Pagamento')],
  ['opcoesDeCurso', noPasso('Vagas')],
  ['distribuicaoVagas', noPasso('Vagas')],
  ['ordemDeRemanejamento', noPasso('Vagas')],
  ['cronograma', doBlocoDoCronograma],
  ['etapas', noPasso('Cronograma', 'etapa')],
  ['documentosExigidos', noPasso('Cronograma', 'documentos')],
  ['motivos', noPasso('Cronograma', 'decisoes')],
  ['classificacao', doBlocoDaClassificacao],
  ['fada', noPasso('Fator de Atenuação')],
  ['atendimento', noPasso('Atend. especial')],
  ['formularios', noPasso('Formulários')],
  ['coleta', noPasso('Formulários')],
  ['provaPresencial', () => SEM_TELA],
  ['importacao', () => SEM_TELA],
  ['divulgacao', () => SEM_TELA],
]);

/**
 * O passo que a pendência abre, pelo ponteiro (RFC 6901) da recusa ou do diagnóstico. O mapa
 * olha só a seção do documento e, quando o passo depende dele, o campo logo abaixo.
 */
export function passoDoPonteiro(ponteiro: string): DestinoDoPonteiro {
  const leitura = segmentosDoPonteiro(ponteiro);
  if (!leitura.lido) return FORA_DO_MAPA;
  const [secao, campo] = leitura.segmentos;
  const resolucao = secao === undefined ? undefined : RESOLUCAO_POR_SECAO.get(secao);
  return resolucao === undefined ? FORA_DO_MAPA : resolucao(campo);
}
