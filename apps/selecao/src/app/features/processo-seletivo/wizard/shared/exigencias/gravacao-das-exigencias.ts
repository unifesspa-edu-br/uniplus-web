import type { ItemDocumentoExigidoInput, NoExigenciaInput } from '@uniplus/shared-data/selecao';

import type {
  BaseLegalConfig,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';

import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { documentosDe } from './consulta-das-exigencias';
import { APLICABILIDADE_GERAL } from './exigencias-documentais';
import { finalidadeEnviada } from './formulario-da-exigencia';
import { comRecorteDeModalidade, recorteDeModalidades } from './recorte-por-modalidade';

/** O processo vivo contra o qual a árvore do rascunho é resolvida e podada. */
export interface ProcessoVivoDasExigencias {
  readonly faseIdPorCodigo: ReadonlyMap<string, string>;
  readonly modalidadesOfertadas: readonly string[];
  readonly etapasVivas: ReadonlySet<string>;
  readonly finalidadesPorFase: ReadonlyMap<string, readonly string[]>;
}

/**
 * Serializa a árvore do rascunho no que o `PUT` recebe, resolvendo o que é declarado por
 * código contra o processo vivo e podando o que o cronograma invalidou.
 *
 * A poda não é zelo: o `PUT` recusa a árvore inteira se um nó apontar fase que saiu do
 * cronograma (`FaseNaoPertenceAoProcesso`), etapa que não é da fase (`EtapaNaoPertenceAFase`),
 * cláusula de modalidade esvaziada (`ClausulaVazia`) ou grupo sem filhos (`GrupoVazio`) — e a
 * recusa chegaria sobre configuração que a tela não mostra mais.
 */
export function arvoreDeExigencias(
  exigencias: ExigenciasDoRascunho,
  processo: ProcessoVivoDasExigencias,
): readonly NoExigenciaInput[] {
  const completas = comAlcanceDeTodasAsFases(exigencias, [...processo.faseIdPorCodigo.keys()]);
  return completas.raizes.flatMap((raiz) =>
    podar([raiz], processo, finalidadeDaRaiz(raiz, processo)),
  );
}

/**
 * O formulário da árvore de raiz, declarado na primeira folha que sobrevive à poda e herdado por
 * todas as outras: o servidor recusa grupo com documentos de formulários diferentes.
 */
function finalidadeDaRaiz(raiz: NoDeExigencia, processo: ProcessoVivoDasExigencias): string | null {
  const declarante = documentosDe([raiz]).find((documento) =>
    processo.faseIdPorCodigo.has(documento.faseCodigo),
  );
  return declarante === undefined
    ? null
    : finalidadeEnviada(
        declarante.finalidade,
        processo.finalidadesPorFase.get(declarante.faseCodigo) ?? [],
      );
}

function podar(
  nos: readonly NoDeExigencia[],
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): readonly NoExigenciaInput[] {
  const vivos: NoExigenciaInput[] = [];

  for (const no of nos) {
    if (no.tipo === 'FOLHA') {
      const documento = no.documento;
      // A fase saiu do cronograma depois de o documento ser marcado nela.
      if (documento === null || !processo.faseIdPorCodigo.has(documento.faseCodigo)) continue;

      vivos.push({
        ...comoNo(no),
        documento: folha(documento, processo, finalidade),
        filhos: null,
      });
      continue;
    }

    const filhos = podar(no.filhos ?? [], processo, finalidade);
    // Grupo que perdeu todos os filhos deixa de existir — mandá-lo vazio derrubaria a
    // gravação inteira, e um grupo sem alternativa nenhuma não exige coisa alguma.
    if (filhos.length === 0) continue;

    vivos.push({ ...comoNo(no), documento: null, filhos });
  }

  return vivos;
}

/** Os campos do nó que o rascunho carrega sem tocar, inclusive os que a tela não edita. */
function comoNo(no: NoDeExigencia): NoExigenciaInput {
  return {
    tipo: no.tipo,
    documento: null,
    quantidadeMinima: no.quantidadeMinima ?? null,
    consequencia: no.consequencia,
    basesLegais: no.basesLegais === null ? null : no.basesLegais.map(comoBaseLegal),
    filhos: null,
    chaveDistincao: no.chaveDistincao,
    dataReferencia: no.dataReferencia,
    ocorrenciasEsperadas: no.ocorrenciasEsperadas,
    repetePorEntidade: no.repetePorEntidade,
  };
}

/** Norma sem referência não viaja: é linha em branco do formulário, não declaração. */
function comoBaseLegal(base: BaseLegalConfig): {
  referencia: string;
  abrangencia: string;
  status: string;
  observacao: string | null;
} {
  return {
    referencia: base.referencia.trim(),
    abrangencia: base.abrangencia,
    status: base.status,
    observacao: base.observacao.trim() === '' ? null : base.observacao.trim(),
  };
}

function folha(
  documento: ExigenciaDeDocumento,
  processo: ProcessoVivoDasExigencias,
  finalidade: string | null,
): ItemDocumentoExigidoInput {
  const { faseIdPorCodigo } = processo;
  const recorte = recorteDeModalidades(documento, processo.modalidadesOfertadas);

  return {
    exigidoNaFaseId: faseIdPorCodigo.get(documento.faseCodigo) ?? '',
    exigidoNaEtapaId: etapaViva(documento, processo.etapasVivas),
    finalidade,
    tipoDocumentoId: documento.tipoDocumentoId,
    // A aplicabilidade é DECLARADA, nunca inferida das condições (ADR-0071): "exigida de quem
    // satisfaz" com gatilho vazio é estado legítimo — exigida de ninguém —, e derivá-la da
    // presença de condição tornaria esse estado inalcançável pela tela.
    //
    // Quando é de todos, TODA condição sai: o agregado recusa a exigência geral que carrega
    // gatilho, e antes disto uma condição sobre outro fato viajava junto com a aplicabilidade
    // rebaixada — inclusive quando o operador marcava todas as modalidades.
    aplicabilidade: documento.aplicabilidade,
    obrigatorio: documento.obrigatorio,
    consequenciaIndeferimento:
      documento.consequenciaIndeferimento === '' ? null : documento.consequenciaIndeferimento,
    condicoes:
      documento.aplicabilidade === APLICABILIDADE_GERAL
        ? []
        : comRecorteDeModalidade(documento.condicoes, recorte),
    // A publicação exige base legal resolvida de toda exigência que decide o resultado; a
    // que não decide pode seguir sem norma declarada. Linha em branco não conta como norma.
    basesLegais: documento.basesLegais
      .filter((base) => base.referencia.trim() !== '')
      .map(comoBaseLegal),
    idadeMaximaEmissao: comoIdadeMaxima(documento.idadeMaximaEmissao, faseIdPorCodigo),
    formatosPermitidos:
      documento.formatosPermitidos as ItemDocumentoExigidoInput['formatosPermitidos'],
    tamanhoMaximoBytes: documento.tamanhoMaximoBytes,
    modeloId: documento.modelo?.modeloId ?? null,
  };
}

/**
 * A etapa que coletava saiu do cronograma: o documento volta a ser da fase inteira em vez de
 * referenciar um identificador que o processo não tem mais.
 */
function etapaViva(
  documento: ExigenciaDeDocumento,
  etapasVivas: ReadonlySet<string>,
): string | null {
  const etapaId = documento.etapaId;
  return etapaId !== null && etapaId !== '' && etapasVivas.has(etapaId) ? etapaId : null;
}

/**
 * A idade máxima, com a fase âncora resolvida de volta para identificador.
 *
 * A fase que ancorava saiu do cronograma: a âncora é limpa em vez de viajar apontando para
 * linha que não existe mais. O servidor recusaria com `IdadeMaximaEmissao.FaseNaoPertenceAoProcesso`,
 * e a recusa falaria de um campo que esta tela não renderiza — o operador não teria o que fazer.
 */
function comoIdadeMaxima(
  idade: ExigenciaDeDocumento['idadeMaximaEmissao'],
  faseIdPorCodigo: ReadonlyMap<string, string>,
): ItemDocumentoExigidoInput['idadeMaximaEmissao'] {
  if (idade === null) return null;

  const faseId =
    idade.referenciaFaseCodigo === null ? null : faseIdPorCodigo.get(idade.referenciaFaseCodigo);
  if (idade.referenciaFaseCodigo !== null && faseId === undefined) return null;

  return {
    valor: idade.valor,
    unidade: idade.unidade,
    referenciaTipo: idade.referenciaTipo,
    data: idade.data,
    referenciaFaseId: faseId ?? null,
  };
}
