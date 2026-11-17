import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoDistribuicaoDeVagas,
} from '@uniplus/shared-data/selecao';

import { rotuloDoCodigo, type CatalogoPorCodigo } from '../catalogos-por-codigo';
import {
  definirCascata,
  ordensDoDocumento,
  removerCascata,
  type MatrizDaCascata,
} from '../edicoes/cascata-de-remanejamento.edicao';
import {
  definirModalidades,
  definirPercentualDaReservaLegal,
  definirReferenciaDemografica,
  definirRegraDeAjuste,
  definirRegraDeDistribuicao,
  definirVagasOfertadasBase,
  type PercentualDaReserva,
} from '../edicoes/distribuicao-de-vagas.edicao';
import {
  definirNumeroDeOpcoes,
  opcoesDeCursoDoCampo,
  type OpcoesDeCursoDoCampo,
} from '../edicoes/opcoes-de-curso.edicao';
import { paresPorOrigem } from '../edicoes/itens-por-origem';
import { comLista, emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { regraEscolhida, type RegraEscolhida } from '../regra-escolhida';
import { textoDoNumero } from '../texto-do-campo';

type Distribuicao = DocumentoDaConfiguracaoDistribuicaoDeVagas;

export interface ModalidadeDaOferta {
  readonly origem: number | null;
  readonly codigo: string;
  readonly rotulo: string;
  /** A quantidade que o edital fixa; vazia quando o sistema a calcula. */
  readonly quantidade: string;
}

export interface OfertaDasVagas {
  readonly origem: number | null;
  readonly ofertaCodigo: string;
  readonly rotulo: string;
  readonly vagasOfertadasBase: string;
  readonly percentualDaReserva: PercentualDaReserva;
  readonly regraDeDistribuicao: RegraEscolhida | null;
  readonly regraDeAjuste: RegraEscolhida | null;
  /** O código do censo de referência demográfica. */
  readonly referenciaDemografica: string | null;
  readonly modalidades: readonly ModalidadeDaOferta[];
  /** Só leitura: o quadro que a API calculou a partir dos insumos. A edição não o escreve. */
  readonly quadroCalculado: NonNullable<Distribuicao['quadro']>;
}

export interface CascataDasVagas {
  readonly regra: RegraEscolhida | null;
  readonly matriz: MatrizDaCascata;
}

export interface ValoresDasVagas {
  readonly numeroDeOpcoes: OpcoesDeCursoDoCampo;
  readonly ofertas: readonly OfertaDasVagas[];
  /** `null` é processo sem cascata de remanejamento. */
  readonly cascata: CascataDasVagas | null;
}

export interface CatalogosDasVagas {
  readonly ofertas: CatalogoPorCodigo;
  readonly modalidades: CatalogoPorCodigo;
}

function percentualDaReservaDe(oferta: Distribuicao): PercentualDaReserva {
  const percentual = oferta.percentualDaReservaLegal;
  if (percentual === undefined) return { estado: 'naoDeclarado' };
  return percentual === null
    ? { estado: 'fixadoNoEdital' }
    : { estado: 'valor', texto: textoDoNumero(percentual) };
}

function modalidadesDe(oferta: Distribuicao, catalogo: CatalogoPorCodigo): ModalidadeDaOferta[] {
  return (oferta.modalidades ?? []).map((modalidade, origem) => ({
    origem,
    codigo: modalidade.codigo,
    rotulo: rotuloDoCodigo(catalogo, modalidade.codigo, modalidade.descricao ?? undefined),
    quantidade: textoDoNumero(modalidade.quantidadeDeclarada),
  }));
}

function quadroDaOferta(oferta: Distribuicao, catalogo: CatalogoPorCodigo) {
  return {
    modalidades: modalidadesDe(oferta, catalogo),
    quadroCalculado: oferta.quadro ?? [],
  };
}

function regrasEReferenciaDaOferta(oferta: Distribuicao) {
  return {
    regraDeDistribuicao: regraEscolhida(oferta.regraDistribuicao),
    regraDeAjuste: regraEscolhida(oferta.regraAjuste),
    referenciaDemografica: oferta.referenciaDemograficaCodigo ?? null,
  };
}

function ofertaDe(
  oferta: Distribuicao,
  catalogos: CatalogosDasVagas,
  origem: number,
): OfertaDasVagas {
  return {
    origem,
    ofertaCodigo: oferta.ofertaCursoCodigo,
    rotulo: rotuloDoCodigo(catalogos.ofertas, oferta.ofertaCursoCodigo, oferta.cursoNome),
    vagasOfertadasBase: textoDoNumero(oferta.vagasOfertadasBase),
    percentualDaReserva: percentualDaReservaDe(oferta),
    ...regrasEReferenciaDaOferta(oferta),
    ...quadroDaOferta(oferta, catalogos.modalidades),
  };
}

function cascataDe(documento: DocumentoDaConfiguracao): CascataDasVagas | null {
  const cascata = documento.cascataRemanejamento;
  if (cascata === undefined) return null;
  return {
    regra: regraEscolhida(cascata.regra),
    matriz: {
      fallbackCodigo: cascata.fallbackCodigo ?? '',
      ordens: ordensDoDocumento(cascata.destinos ?? []),
    },
  };
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDasVagas,
): ValoresDasVagas {
  return {
    numeroDeOpcoes: opcoesDeCursoDoCampo(documento.opcoesDeCurso?.numero),
    ofertas: (documento.distribuicaoVagas ?? []).map((oferta, origem) =>
      ofertaDe(oferta, catalogos, origem),
    ),
    cascata: cascataDe(documento),
  };
}

function sincronizarOfertas(ofertas: readonly OfertaDasVagas[]): EdicaoDoDocumento {
  return (documento) => {
    const pares = paresPorOrigem(documento.distribuicaoVagas ?? [], ofertas);
    const distribuicao = pares.map(([atual, oferta]) =>
      atual?.ofertaCursoCodigo === oferta.ofertaCodigo
        ? atual
        : { ofertaCursoCodigo: oferta.ofertaCodigo },
    );
    return comLista(documento, 'distribuicaoVagas', distribuicao);
  };
}

function edicaoDaOferta(oferta: OfertaDasVagas, posicao: number): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirVagasOfertadasBase(documento, posicao, oferta.vagasOfertadasBase),
    (documento) => definirPercentualDaReservaLegal(documento, posicao, oferta.percentualDaReserva),
    (documento) => definirRegraDeDistribuicao(documento, posicao, oferta.regraDeDistribuicao),
    (documento) => definirRegraDeAjuste(documento, posicao, oferta.regraDeAjuste),
    (documento) =>
      definirReferenciaDemografica(documento, posicao, oferta.referenciaDemografica ?? ''),
    (documento) => definirModalidades(documento, posicao, oferta.modalidades),
  );
}

function edicaoDaCascata(cascata: CascataDasVagas | null): EdicaoDoDocumento {
  return cascata === null
    ? removerCascata
    : (documento) => definirCascata(documento, cascata.regra, cascata.matriz);
}

export function edicaoDoPasso(valores: ValoresDasVagas): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirNumeroDeOpcoes(documento, valores.numeroDeOpcoes),
    sincronizarOfertas(valores.ofertas),
    ...valores.ofertas.map(edicaoDaOferta),
    edicaoDaCascata(valores.cascata),
  );
}
