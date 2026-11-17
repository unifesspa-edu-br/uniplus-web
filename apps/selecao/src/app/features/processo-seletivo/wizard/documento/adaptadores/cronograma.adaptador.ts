import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoCronogramaFase,
  DocumentoDaConfiguracaoEtapa,
} from '@uniplus/shared-data/selecao';
import { rotuloDaUnidade } from '@uniplus/shared-data/organizacao';

import { rotuloDoCodigo, type CatalogoPorCodigo } from '../catalogos-por-codigo';
import { campoDoInstante } from '../../shared/fuso-institucional';
import type { ItemDoFormulario, NivelDoFormulario } from '../edicoes/avaliacao-da-etapa.edicao';
import { definirEtapas, type EtapaDoFormulario } from '../edicoes/etapas.edicao';
import { definirFases, type FaseDoFormulario } from '../edicoes/fases-do-cronograma.edicao';
import { definirConvencaoDeContagem } from '../edicoes/identificacao.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { regraEscolhida, type RegraEscolhida } from '../regra-escolhida';
import { textoDoNumero } from '../texto-do-campo';
import { percentualDaFracao } from '../percentual-do-campo';

/** A fase como o passo a mostra: os valores editáveis e o que o catálogo e o documento dizem dela. */
export interface FaseDoCronograma extends FaseDoFormulario {
  readonly rotulo: string;
  readonly unidadeResponsavelRotulo: string;
}

/** A etapa como o passo a mostra: os valores editáveis e o rótulo do tipo de etapa. */
export interface EtapaDoCronograma extends EtapaDoFormulario {
  readonly tipoEtapaRotulo: string;
}

export interface ValoresDoCronograma {
  readonly fases: readonly FaseDoCronograma[];
  readonly etapas: readonly EtapaDoCronograma[];
  readonly convencaoDeContagem: RegraEscolhida | null;
}

export interface CatalogosDoCronograma {
  readonly fases: CatalogoPorCodigo;
  readonly unidades: CatalogoPorCodigo;
  readonly tiposDeEtapa: CatalogoPorCodigo;
}

function campoDoDocumento(instante: string | undefined): string {
  return instante === undefined ? '' : campoDoInstante(instante);
}

function rotuloDaUnidadeGravada(fase: DocumentoDaConfiguracaoCronogramaFase): string | undefined {
  const { unidadeResponsavelSigla: sigla, unidadeResponsavelNome: nome } = fase;
  return sigla === undefined || nome === undefined ? undefined : rotuloDaUnidade({ sigla, nome });
}

function unidadeDe(fase: DocumentoDaConfiguracaoCronogramaFase, catalogo: CatalogoPorCodigo) {
  const codigo = fase.unidadeResponsavelCodigo ?? '';
  return {
    unidadeResponsavelCodigo: codigo,
    unidadeResponsavelRotulo: rotuloDoCodigo(catalogo, codigo, rotuloDaUnidadeGravada(fase)),
  };
}

function faseDe(
  fase: DocumentoDaConfiguracaoCronogramaFase,
  catalogos: CatalogosDoCronograma,
): FaseDoCronograma {
  const faseCanonicaCodigo = fase.faseCanonicaCodigo ?? '';
  return {
    chave: fase.chave,
    faseCanonicaCodigo,
    rotulo: rotuloDoCodigo(catalogos.fases, faseCanonicaCodigo, undefined),
    inicio: campoDoDocumento(fase.inicio),
    fim: campoDoDocumento(fase.fim),
    ...unidadeDe(fase, catalogos.unidades),
  };
}

function itensDe(etapa: DocumentoDaConfiguracaoEtapa): readonly ItemDoFormulario[] {
  return (etapa.itensDeAvaliacao ?? []).map((item, origem) => ({
    origem,
    chave: item.chave,
    rotulo: item.rotulo ?? '',
    pontuacaoMaxima: textoDoNumero(item.pontuacaoMaxima),
  }));
}

function niveisDe(etapa: DocumentoDaConfiguracaoEtapa): readonly NivelDoFormulario[] {
  return (etapa.escalaDeAtendimento ?? []).map((nivel, origem) => ({
    origem,
    chave: nivel.chave,
    rotulo: nivel.rotulo ?? '',
    percentual: percentualDaFracao(nivel.fracao),
  }));
}

function notasDe(etapa: DocumentoDaConfiguracaoEtapa) {
  return {
    peso: textoDoNumero(etapa.peso),
    notaMinima: textoDoNumero(etapa.notaMinima),
    notaMaxima: textoDoNumero(etapa.notaMaxima),
    passoDoLancamento: textoDoNumero(etapa.passoDoLancamento),
  };
}

type IdentidadeDaEtapa = Pick<
  EtapaDoCronograma,
  'chave' | 'nome' | 'carater' | 'tipoEtapaCodigo' | 'tipoEtapaRotulo' | 'faseChave'
>;

function identidadeDe(
  etapa: DocumentoDaConfiguracaoEtapa,
  catalogo: CatalogoPorCodigo,
): IdentidadeDaEtapa {
  const tipoEtapaCodigo = etapa.tipoEtapaCodigo ?? '';
  return {
    chave: etapa.chave,
    nome: etapa.nome ?? '',
    carater: etapa.carater ?? '',
    tipoEtapaCodigo,
    tipoEtapaRotulo: rotuloDoCodigo(catalogo, tipoEtapaCodigo, undefined),
    faseChave: etapa.faseChave ?? '',
  };
}

type AvaliacaoDaEtapa = Pick<
  EtapaDoCronograma,
  | 'peso'
  | 'notaMinima'
  | 'notaMaxima'
  | 'passoDoLancamento'
  | 'formaDeAvaliacao'
  | 'regraDeConsolidacao'
  | 'itensDeAvaliacao'
  | 'escalaDeAtendimento'
>;

function avaliacaoDe(etapa: DocumentoDaConfiguracaoEtapa): AvaliacaoDaEtapa {
  return {
    ...notasDe(etapa),
    formaDeAvaliacao: etapa.formaDeAvaliacao ?? '',
    regraDeConsolidacao: regraEscolhida(etapa.regraConsolidacao),
    itensDeAvaliacao: itensDe(etapa),
    escalaDeAtendimento: niveisDe(etapa),
  };
}

function etapaDe(
  etapa: DocumentoDaConfiguracaoEtapa,
  catalogos: CatalogosDoCronograma,
): EtapaDoCronograma {
  return {
    ...identidadeDe(etapa, catalogos.tiposDeEtapa),
    ...avaliacaoDe(etapa),
    inicio: campoDoDocumento(etapa.inicio),
    fim: campoDoDocumento(etapa.fim),
  };
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDoCronograma,
): ValoresDoCronograma {
  return {
    fases: fasesDoDocumento(documento, catalogos),
    etapas: etapasDoDocumento(documento, catalogos),
    convencaoDeContagem: regraEscolhida(documento.identificacao?.algoritmoContagemPrazo),
  };
}

export function edicaoDoPasso(valores: ValoresDoCronograma): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirFases(documento, valores.fases),
    (documento) => definirEtapas(documento, valores.etapas),
    (documento) => definirConvencaoDeContagem(documento, valores.convencaoDeContagem),
  );
}

function fasesDoDocumento(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDoCronograma,
): FaseDoCronograma[] {
  return (documento.cronograma?.fases ?? []).map((fase, origem) => ({
    ...faseDe(fase, catalogos),
    origem,
  }));
}

function etapasDoDocumento(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDoCronograma,
): EtapaDoCronograma[] {
  return (documento.etapas ?? []).map((etapa, origem) => ({
    ...etapaDe(etapa, catalogos),
    origem,
  }));
}
