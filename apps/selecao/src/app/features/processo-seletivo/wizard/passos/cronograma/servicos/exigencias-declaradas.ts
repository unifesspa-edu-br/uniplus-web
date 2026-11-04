import type { ExigenciaDeDocumento, FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverFase, finalidadesDaFase } from '../../../shared/descricao-da-fase';
import { comAlcanceDeTodasAsFases } from '../../../shared/exigencias/alcance-das-exigencias';
import {
  exigenciasLocalizadas,
  type RepeticaoDaExigencia,
} from '../../../shared/exigencias/consulta-das-exigencias';
import {
  CONSEQUENCIA_REENVIO,
  exigenciaDecideResultado,
  temNormaResolvida,
} from '../../../shared/exigencias/exigencias-documentais';
import { faltaOFormulario } from '../../../shared/exigencias/formulario-da-exigencia';
import {
  dominiosDoGatilho,
  fatosParaGatilho,
  type FatoEscolhivel,
  nomesDoCatalogo,
  podeAlcancarModalidade,
  problemasDoGatilho,
  recusasDeFaseDoGatilho,
} from '../../../shared/gatilho-de-exigencia';
import {
  orientacaoDaRecusaDaRepeticao,
  type NomesDaOrientacao,
} from '../../../shared/orientacao-da-recusa-do-fato';
import {
  camposDaRepeticao,
  fasesNoCronograma,
  producaoDoRascunho,
  recusaDaRepeticao,
  type LugarDaExigencia,
  type ProducaoDosFatos,
} from '../../../shared/producao-dos-fatos';
import type { CatalogoDeDocumentos } from '../catalogos/catalogo-de-documentos.service';
import type { CatalogoDeFases } from '../catalogos/catalogo-de-fases.service';
import type { CatalogoDeFatos } from '../catalogos/catalogo-de-fatos.service';
import type { ExigenciaDeclarada } from '../conferencia-das-exigencias-declaradas';

/** O que a conferência das exigências lê dos catálogos, para nomear documento, fato e fase. */
export type CatalogosDasExigencias = Pick<CatalogoDeDocumentos, 'tiposDocumento'> &
  Pick<CatalogoDeFatos, 'fatos'> &
  Pick<CatalogoDeFases, 'fasePorId' | 'nomeDaFase'>;

/** O que se consulta ao julgar cada exigência, lido uma vez do rascunho e dos catálogos. */
interface ContextoDasExigencias {
  readonly nomePorId: ReadonlyMap<string, string>;
  readonly fasePorCodigo: ReadonlyMap<string, FaseDoCronograma>;
  readonly fasePorId: ReturnType<CatalogosDasExigencias['fasePorId']>;
  readonly ofertadas: readonly string[];
  readonly fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>;
  readonly nomePorCodigo: ReadonlyMap<string, string>;
  readonly producao: ProducaoDosFatos;
  readonly nomes: NomesDaOrientacao;
}

function contextoDasExigencias(
  fases: readonly FaseDoCronograma[],
  store: Pick<ProcessoSeletivoStore, 'draft' | 'modalidadesDoProcesso'>,
  catalogos: CatalogosDasExigencias,
): ContextoDasExigencias {
  const ofertadas = [...new Set(store.modalidadesDoProcesso())];
  const fasePorId = catalogos.fasePorId();
  const nomePorCodigo = nomesDoCatalogo(catalogos.fatos());
  // O gatilho é conferido contra o MESMO catálogo que a superfície da fase oferece: o que a
  // tela não soube propor, ela também não sabe validar, e apontar um fato que o editor não
  // mostra deixaria o operador sem o que fazer.
  const fatosDoGatilho = fatosParaGatilho(
    catalogos.fatos(),
    dominiosDoGatilho(
      catalogos.fatos(),
      store.draft().atendimento.condicoes.map((condicao) => condicao.codigo),
      ofertadas,
    ),
  );

  return {
    nomePorId: new Map(catalogos.tiposDocumento().map((tipo) => [tipo.id, tipo.nome])),
    fasePorCodigo: new Map(fases.map((fase) => [fase.codigo, fase])),
    fasePorId,
    ofertadas,
    fatoPorCodigo: new Map(fatosDoGatilho.map((fato) => [fato.codigo, fato])),
    nomePorCodigo,
    // A fase de cada fato é lida das fases como estão na tela, não das gravadas: reordenar o
    // cronograma pode deixar um gatilho citando o que só se conhece depois da exigência.
    producao: producaoDoRascunho(
      store.draft().formulario,
      fasesNoCronograma(fases, fasePorId),
      catalogos.fatos(),
    ),
    nomes: {
      fato: (codigo: string) => nomePorCodigo.get(codigo) ?? codigo,
      fase: catalogos.nomeDaFase(),
    },
  };
}

/** Os problemas da fase e do gatilho que a exigência carrega, sem repetir a mesma orientação. */
function problemasDeFaseDaExigencia(
  exigencia: LugarDaExigencia & ExigenciaDeDocumento,
  repeticao: RepeticaoDaExigencia | null,
  contexto: ContextoDasExigencias,
): readonly string[] {
  const { producao, nomes } = contexto;
  return [
    ...new Set([
      ...problemaDaRepeticao(repeticao, exigencia, producao, nomes),
      ...recusasDeFaseDoGatilho(
        exigencia,
        producao,
        nomes,
        camposDaRepeticao(repeticao?.grupo ?? null, producao),
      ).map((recusa) => recusa.orientacao),
    ]),
  ];
}

/**
 * As exigências que o rascunho declara, na forma que a conferência entende: o nome que a
 * pessoa lê, se a exigência decide o resultado e se a norma que a sustenta está resolvida.
 *
 * Percorre as exigências, não os tipos de documento: a norma é declarada POR exigência, e o
 * mesmo documento pode decidir o resultado numa fase e não na outra. Confere o que a gravação
 * envia: o documento que vale em todas as fases é materializado também na fase acrescentada
 * depois do regime, e só assim a cópia dela é conferida antes do envio.
 */
export function exigenciasDeclaradas(
  fases: readonly FaseDoCronograma[],
  store: Pick<ProcessoSeletivoStore, 'draft' | 'modalidadesDoProcesso'>,
  catalogos: CatalogosDasExigencias,
): readonly ExigenciaDeclarada[] {
  const contexto = contextoDasExigencias(fases, store, catalogos);
  const materializadas = comAlcanceDeTodasAsFases(
    store.draft().documentos,
    fases.map((fase) => fase.codigo),
  );

  return exigenciasLocalizadas(materializadas).map(({ documento, repeticao }) =>
    exigenciaDeclarada(documento, repeticao, contexto),
  );
}

function exigenciaDeclarada(
  exigencia: ExigenciaDeDocumento,
  repeticao: RepeticaoDaExigencia | null,
  contexto: ContextoDasExigencias,
): ExigenciaDeclarada {
  const fase = contexto.fasePorCodigo.get(exigencia.faseCodigo);
  const descricao = fase === undefined ? null : descreverFase(fase, contexto.fasePorId);
  const admiteComplementacao = descricao?.permiteComplementacao ?? false;
  const semFormulario =
    fase !== undefined &&
    faltaOFormulario(exigencia.finalidade, finalidadesDaFase(fase, contexto.fasePorId)) !== null;

  return {
    nome: contexto.nomePorId.get(exigencia.tipoDocumentoId) ?? exigencia.tipoDocumentoId,
    decideResultado: exigenciaDecideResultado(exigencia),
    normaResolvida: temNormaResolvida(exigencia.basesLegais),
    faseCodigo: exigencia.faseCodigo,
    faseViva: fase !== undefined,
    alcancaModalidade: contexto.ofertadas.some((codigo) =>
      podeAlcancarModalidade(exigencia, codigo),
    ),
    reenvioSemComplementacao:
      exigencia.consequenciaIndeferimento === CONSEQUENCIA_REENVIO && !admiteComplementacao,
    semFormulario,
    problemasDeGatilho: problemasDoGatilho(
      exigencia,
      contexto.fatoPorCodigo,
      contexto.nomePorCodigo,
    ),
    problemasDeFase: problemasDeFaseDaExigencia(exigencia, repeticao, contexto),
  };
}

/** A repetição que não vale onde o documento é cobrado, dita com o que fazer; nada quando vale ou não há. */
function problemaDaRepeticao(
  repeticao: RepeticaoDaExigencia | null,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): readonly string[] {
  const recusa = repeticao === null ? null : recusaDaRepeticao(repeticao.grupo, lugar, producao);
  return recusa === null || repeticao === null
    ? []
    : [orientacaoDaRecusaDaRepeticao(recusa, producao, nomes, repeticao.herdada)];
}
