import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoExigencia,
  DocumentoDaConfiguracaoRegraDeComprovacao,
} from '@uniplus/shared-data/selecao';

import type { ExigenciasDoRascunho, RegraDeComprovacao } from '../../modelos/exigencias.models';
import { criarIdentificadorDaRegra } from '../../shared/exigencias/identificador-da-regra';
import { documentosExigidosEmTodasAsFases } from '../../shared/exigencias/em-todas-as-fases';
import { documentosDe } from '../../shared/exigencias/consulta-das-exigencias';
import type { ImpedimentoDaConversao } from '../impedimento-da-conversao';
import type { Fases } from './criterios-do-comprovante';
import {
  camposDaRegraNoEditor,
  exigenciaNoEditor,
  exigenciasPorChave,
  regraEditavel,
  regrasEmOrdem,
} from './exigencia-no-editor';

type Exigencia = DocumentoDaConfiguracaoExigencia;
type Regra = DocumentoDaConfiguracaoRegraDeComprovacao;

export type ResultadoDaLeituraDasExigencias =
  | { readonly ok: true; readonly exigencias: ExigenciasDoRascunho }
  | { readonly ok: false; readonly impedimentos: readonly ImpedimentoDaConversao[] };

interface ContextoDaLeitura {
  readonly ordem: readonly Regra[];
  readonly fases: Fases;
  readonly exigencias: ReadonlyMap<string, Exigencia>;
}

/**
 * As exigências de documento do documento da configuração como o editor as tem. Cada regra de
 * documento traz a exigência que cita, com a fase pelo tipo dela e a posição em que foi lida. Não
 * há conversão quando a fase de uma exigência citada não é única no cronograma, porque o editor
 * identifica a fase pelo tipo.
 */
export function exigenciasDoDocumento(
  documento: DocumentoDaConfiguracao,
): ResultadoDaLeituraDasExigencias {
  const secao = documento.documentosExigidos ?? {};
  const exigencias = secao.exigencias ?? [];
  const fases = documento.cronograma?.fases ?? [];
  const regras = lerRegras(secao.regrasDeComprovacao ?? [], contextoDaLeitura(secao, fases));
  const impedimentos = impedimentosDasFases(exigencias, fases, regras);
  return impedimentos.length > 0
    ? { ok: false, impedimentos }
    : { ok: true, exigencias: comAlcance(regras, fases) };
}

function contextoDaLeitura(
  secao: NonNullable<DocumentoDaConfiguracao['documentosExigidos']>,
  fases: Fases,
): ContextoDaLeitura {
  return {
    ordem: regrasEmOrdem(secao.regrasDeComprovacao ?? []),
    fases,
    exigencias: exigenciasPorChave(secao.exigencias ?? []),
  };
}

function comAlcance(regras: RegraDeComprovacao[], fases: Fases): ExigenciasDoRascunho {
  const codigos = fases.map((fase) => fase.tipoFaseCodigo);
  return {
    regrasDeComprovacao: regras,
    emTodasAsFases: documentosExigidosEmTodasAsFases(regras, codigos),
  };
}

function lerRegras(regras: readonly Regra[], contexto: ContextoDaLeitura): RegraDeComprovacao[] {
  return regras.flatMap((regra) =>
    regraEditavel(regra, contexto.exigencias)
      ? [lerRegra(regra, contexto.ordem.indexOf(regra), contexto)]
      : [],
  );
}

function lerRegra(regra: Regra, origem: number, contexto: ContextoDaLeitura): RegraDeComprovacao {
  const campos = camposDaRegraNoEditor(regra);
  const exigencia = regra.exigenciaChave && contexto.exigencias.get(regra.exigenciaChave);
  return {
    identificadorNoRascunho: criarIdentificadorDaRegra(),
    origem,
    ...campos,
    documento: exigencia ? exigenciaNoEditor(exigencia, contexto.fases) : null,
    itens: regra.itens === undefined ? null : lerRegras(regra.itens, contexto),
  };
}

function impedimentosDasFases(
  exigencias: readonly Exigencia[],
  fases: Fases,
  regras: readonly RegraDeComprovacao[],
): ImpedimentoDaConversao[] {
  const citadas = new Set(documentosDe(regras).map((documento) => documento.chave));
  const primeiras = new Set<string>();
  return exigencias.flatMap((exigencia, posicao) => {
    if (primeiras.has(exigencia.chave) || !citadas.has(exigencia.chave)) return [];
    primeiras.add(exigencia.chave);
    const mensagem = problemaDaFase(exigencia.faseChave, fases);
    const caminho = `/documentosExigidos/exigencias/${posicao}/faseChave`;
    return mensagem === null ? [] : [{ caminho, mensagem }];
  });
}

function problemaDaFase(faseChave: string | undefined, fases: Fases): string | null {
  if (faseChave === undefined) return 'A exigência não informa a fase em que é exigida.';
  const fase = fases.find((candidata) => candidata.chave === faseChave);
  if (fase === undefined) return 'A fase da exigência não existe no cronograma.';
  const repetida = fases.filter((outra) => outra.tipoFaseCodigo === fase.tipoFaseCodigo).length > 1;
  return repetida
    ? 'O tipo da fase da exigência aparece mais de uma vez no cronograma e a tela não distingue as fases.'
    : null;
}
