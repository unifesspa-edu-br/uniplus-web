import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoBanca,
  DocumentoDaConfiguracaoProduto,
  DocumentoDaConfiguracaoPropriedadesDoRecurso,
  DocumentoDaConfiguracaoRecursoDaEtapa,
  DocumentoDaConfiguracaoRegraDeDeliberacao,
} from '@uniplus/shared-data/selecao';

import {
  definirBancas,
  type BancaDoFormulario,
  type DeliberacaoDoFormulario,
} from '../edicoes/bancas.edicao';
import {
  definirDecisoesDaEtapa,
  definirDecisoesDaFase,
  type DecisoesDaEtapa,
  type DecisoesDaFase,
} from '../edicoes/decisoes-da-fase-e-da-etapa.edicao';
import type { ProdutoDoFormulario } from '../edicoes/produtos-e-decisoes.edicao';
import {
  definirRecursoDaFase,
  definirRecursosDaEtapa,
  type RecursoDaEtapaDoFormulario,
  type RecursoDoFormulario,
} from '../edicoes/recurso.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import {
  editarOcorrenciaDaEtapa,
  editarOcorrenciaDaFase,
} from '../edicoes/ocorrencia-da-fase-ou-etapa';
import { textoDoNumero } from '../texto-do-campo';

/** O que o passo da fase edita nela, fora o cronograma e as exigências. */
export interface ValoresDaFase extends DecisoesDaFase {
  readonly bancas: readonly BancaDoFormulario[];
  readonly recurso: RecursoDoFormulario | null;
}

/** O mesmo para a etapa, que pode ter mais de um recurso. */
export interface ValoresDaEtapa extends DecisoesDaEtapa {
  readonly bancas: readonly BancaDoFormulario[];
  readonly recursos: readonly RecursoDaEtapaDoFormulario[];
}

function produtoDe(produto: DocumentoDaConfiguracaoProduto, origem: number): ProdutoDoFormulario {
  return { origem, atoCodigo: produto.atoCodigo, papel: produto.papel ?? '' };
}

function deliberacaoDe(regra: DocumentoDaConfiguracaoRegraDeDeliberacao): DeliberacaoDoFormulario {
  return {
    modo: regra.modo ?? '',
    integrantes: textoDoNumero(regra.integrantes),
    suplentes: textoDoNumero(regra.suplentes),
    quorum: textoDoNumero(regra.quorum),
    criterio: regra.criterio ?? '',
    desempate: regra.desempate ?? '',
    encerramento: regra.encerramento ?? '',
    semUnanimidade: regra.semUnanimidade ?? '',
  };
}

function bancaDe(banca: DocumentoDaConfiguracaoBanca, origem: number): BancaDoFormulario {
  return {
    origem,
    chave: banca.chave,
    tipoBancaCodigo: banca.tipoBancaCodigo ?? '',
    categoriasDocumentoCodigos: banca.categoriasDocumentoCodigos ?? [],
    regraDeDeliberacao:
      banca.regraDeDeliberacao === undefined ? null : deliberacaoDe(banca.regraDeDeliberacao),
  };
}

type PrazoDoRecurso = Pick<
  RecursoDoFormulario,
  'regraCodigo' | 'regraVersao' | 'prazoValor' | 'prazoUnidade' | 'atoAncoraCodigo'
>;

function prazoDe(recurso: DocumentoDaConfiguracaoPropriedadesDoRecurso): PrazoDoRecurso {
  return {
    regraCodigo: recurso.regraCodigo ?? '',
    regraVersao: recurso.regraVersao ?? '',
    prazoValor: textoDoNumero(recurso.prazoValor),
    prazoUnidade: recurso.prazoUnidade ?? '',
    atoAncoraCodigo: recurso.atoAncoraCodigo ?? '',
  };
}

function recursoDe(recurso: DocumentoDaConfiguracaoPropriedadesDoRecurso): RecursoDoFormulario {
  return {
    ...prazoDe(recurso),
    suspensividadePrimeiraInstanciaValor: textoDoNumero(
      recurso.suspensividadePrimeiraInstanciaValor,
    ),
    suspensividadePrimeiraInstanciaUnidade: recurso.suspensividadePrimeiraInstanciaUnidade ?? '',
    admiteInstanciaSuperior: recurso.admiteInstanciaSuperior ?? null,
    suspensividadeSegundaInstanciaValor: textoDoNumero(recurso.suspensividadeSegundaInstanciaValor),
    suspensividadeSegundaInstanciaUnidade: recurso.suspensividadeSegundaInstanciaUnidade ?? '',
  };
}

function recursoDaEtapaDe(
  recurso: DocumentoDaConfiguracaoRecursoDaEtapa,
  origem: number,
): RecursoDaEtapaDoFormulario {
  return { ...recursoDe(recurso), origem, ancora: recurso.ancora ?? '' };
}

function decisoesDe(parte: {
  readonly produtos?: readonly DocumentoDaConfiguracaoProduto[];
  readonly emiteParecerIndividual?: boolean;
  readonly tiposDeDecisao?: readonly string[];
}): DecisoesDaEtapa {
  return {
    produtos: (parte.produtos ?? []).map(produtoDe),
    emiteParecerIndividual: parte.emiteParecerIndividual ?? null,
    tiposDeDecisao: parte.tiposDeDecisao ?? [],
  };
}

/** Os valores da fase de chave dada, ou `undefined` quando o documento não tem essa fase. */
export function valoresDaFase(
  documento: DocumentoDaConfiguracao,
  faseChave: string,
  ocorrencia = 0,
): ValoresDaFase | undefined {
  const fase = (documento.cronograma?.fases ?? [])
    .filter((item) => item.chave === faseChave)
    .at(ocorrencia);
  if (fase === undefined) return undefined;
  return valoresDaFaseLida(fase);
}

function valoresDaFaseLida(
  fase: NonNullable<NonNullable<DocumentoDaConfiguracao['cronograma']>['fases']>[number],
): ValoresDaFase {
  return {
    ...decisoesDe(fase),
    faseConcluinteChave: fase.faseConcluinteChave ?? '',
    bancas: (fase.bancasRequeridas ?? []).map(bancaDe),
    recurso: fase.regraRecurso === undefined ? null : recursoDe(fase.regraRecurso),
  };
}

/** Os valores da etapa de chave dada, ou `undefined` quando o documento não tem essa etapa. */
export function valoresDaEtapa(
  documento: DocumentoDaConfiguracao,
  etapaChave: string,
  ocorrencia = 0,
): ValoresDaEtapa | undefined {
  const etapa = documento.etapas?.filter((candidata) => candidata.chave === etapaChave)[ocorrencia];
  if (etapa === undefined) return undefined;
  return {
    ...decisoesDe(etapa),
    bancas: (etapa.bancas ?? []).map(bancaDe),
    recursos: (etapa.recursos ?? []).map(recursoDaEtapaDe),
  };
}

export function edicaoDaFase(
  faseChave: string,
  valores: ValoresDaFase,
  ocorrencia = 0,
): EdicaoDoDocumento {
  const editar = emSequencia(
    (documento) => definirDecisoesDaFase(documento, faseChave, valores),
    (documento) => definirBancas(documento, { faseChave }, valores.bancas),
    (documento) => definirRecursoDaFase(documento, faseChave, valores.recurso),
  );
  return (documento) => editarOcorrenciaDaFase(documento, faseChave, ocorrencia, editar);
}

export function edicaoDaEtapa(
  etapaChave: string,
  valores: ValoresDaEtapa,
  ocorrencia = 0,
): EdicaoDoDocumento {
  const editar = emSequencia(
    (documento) => definirDecisoesDaEtapa(documento, etapaChave, valores),
    (documento) => definirBancas(documento, { etapaChave }, valores.bancas),
    (documento) => definirRecursosDaEtapa(documento, etapaChave, valores.recursos),
  );
  return (documento) => editarOcorrenciaDaEtapa(documento, etapaChave, ocorrencia, editar);
}
