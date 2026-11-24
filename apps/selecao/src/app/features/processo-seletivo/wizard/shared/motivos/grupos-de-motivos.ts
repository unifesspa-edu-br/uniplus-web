import { opcoesDoVocabulario, type ItemDeVocabulario } from '@uniplus/shared-data/configuracao';
import type { MotivoDeDecisaoDto } from '@uniplus/shared-data/selecao';

import type { MotivoNoDocumento } from './motivo-no-documento';

/** Um motivo que a fase ou etapa pode escolher ou já escolheu, dentro de um tipo de decisão. */
export interface MotivoOferecido {
  readonly tipoCodigo: string;
  readonly codigo: string;
  readonly descricao: string;
  readonly sentido: string | null;
  readonly subclassificacao: string | null;
  readonly escolhido: boolean;
  /** Desativado no cadastro: segue onde já estava escolhido, mas não entra em escolha nova. */
  readonly desativado: boolean;
}

/** Os motivos de um tipo de decisão, e se a fase ou etapa declara esse tipo. */
export interface GrupoDeMotivos {
  readonly tipoCodigo: string;
  readonly rotulo: string;
  readonly declarado: boolean;
  readonly motivos: readonly MotivoOferecido[];
}

function doCatalogo(motivo: MotivoDeDecisaoDto, escolhido?: MotivoNoDocumento): MotivoOferecido {
  return {
    tipoCodigo: motivo.tipo.codigo,
    codigo: motivo.codigo,
    descricao: escolhido?.descricao ?? motivo.descricao,
    sentido: escolhido?.sentido ?? motivo.sentido?.codigo ?? null,
    subclassificacao: escolhido?.subclassificacao ?? motivo.subclassificacao,
    escolhido: escolhido !== undefined,
    desativado: !motivo.ativo,
  };
}

function soDoDocumento(motivo: MotivoNoDocumento): MotivoOferecido {
  return {
    tipoCodigo: motivo.tipoCodigo,
    codigo: motivo.codigo,
    descricao: motivo.descricao ?? motivo.codigo,
    sentido: motivo.sentido ?? null,
    subclassificacao: motivo.subclassificacao ?? null,
    escolhido: true,
    desativado: false,
  };
}

function oferecidosPeloCatalogo(
  noCatalogo: readonly MotivoDeDecisaoDto[],
  escolhidosDoTipo: readonly MotivoNoDocumento[],
): readonly MotivoOferecido[] {
  return noCatalogo
    .map((motivo) =>
      doCatalogo(
        motivo,
        escolhidosDoTipo.find(({ codigo }) => codigo === motivo.codigo),
      ),
    )
    .filter((motivo) => motivo.escolhido || !motivo.desativado);
}

function escolhidosForaDoCatalogo(
  noCatalogo: readonly MotivoDeDecisaoDto[],
  escolhidosDoTipo: readonly MotivoNoDocumento[],
): readonly MotivoOferecido[] {
  const codigosDoCatalogo = new Set(noCatalogo.map((motivo) => motivo.codigo));
  return escolhidosDoTipo.filter(({ codigo }) => !codigosDoCatalogo.has(codigo)).map(soDoDocumento);
}

/**
 * Os motivos de um tipo: os do cadastro, na ordem dele, e depois os escolhidos que o cadastro não
 * traz. O descritivo do que foi escolhido é o da cópia do documento. O desativado só aparece se
 * já estava escolhido.
 */
function motivosDoTipo(
  tipoCodigo: string,
  catalogo: readonly MotivoDeDecisaoDto[],
  escolhidos: readonly MotivoNoDocumento[],
): readonly MotivoOferecido[] {
  const noCatalogo = catalogo.filter((motivo) => motivo.tipo.codigo === tipoCodigo);
  const escolhidosDoTipo = escolhidos.filter((motivo) => motivo.tipoCodigo === tipoCodigo);
  return [
    ...oferecidosPeloCatalogo(noCatalogo, escolhidosDoTipo),
    ...escolhidosForaDoCatalogo(noCatalogo, escolhidosDoTipo),
  ];
}

type TipoPresente = string | ItemDeVocabulario;

function codigoDoTipo(tipo: TipoPresente): string {
  return typeof tipo === 'string' ? tipo : tipo.codigo;
}

function emOrdemDoCodigo(um: TipoPresente, outro: TipoPresente): number {
  const [codigoUm, codigoOutro] = [codigoDoTipo(um), codigoDoTipo(outro)];
  return codigoUm < codigoOutro ? -1 : Number(codigoUm > codigoOutro);
}

/**
 * Os tipos que a fase ou etapa declara, escolheu ou tem no cadastro, em ordem alfabética do código.
 * O tipo que o cadastro traz leva o rótulo da resposta e vem antes, para valer sobre o código solto.
 */
function tiposPresentes(
  catalogo: readonly MotivoDeDecisaoDto[],
  escolhidos: readonly MotivoNoDocumento[],
  declarados: readonly string[],
): readonly TipoPresente[] {
  return [
    ...catalogo.map((motivo) => motivo.tipo),
    ...declarados,
    ...escolhidos.map((motivo) => motivo.tipoCodigo),
  ].sort(emOrdemDoCodigo);
}

function grupoDoTipo(
  { codigo, rotulo }: ItemDeVocabulario,
  declarados: readonly string[],
  motivosDoCatalogo: readonly MotivoDeDecisaoDto[],
  escolhidos: readonly MotivoNoDocumento[],
): GrupoDeMotivos {
  return {
    tipoCodigo: codigo,
    rotulo: rotulo === codigo ? '' : rotulo,
    declarado: declarados.includes(codigo),
    motivos: motivosDoTipo(codigo, motivosDoCatalogo, escolhidos),
  };
}

/**
 * Os grupos que a tela mostra: um por tipo de decisão que a fase ou etapa declara, que tem motivo
 * no cadastro ou que tem motivo escolhido. Os tipos declarados vêm primeiro; dentro de cada
 * bloco, a ordem é a do vocabulário da API, e o código que o vocabulário não conhece vem por último.
 */
export function agruparPorTipo(
  motivosDoCatalogo: readonly MotivoDeDecisaoDto[],
  escolhidos: readonly MotivoNoDocumento[],
  declarados: readonly string[],
  vocabulario: readonly ItemDeVocabulario[],
): readonly GrupoDeMotivos[] {
  return opcoesDoVocabulario(vocabulario, tiposPresentes(motivosDoCatalogo, escolhidos, declarados))
    .map((tipo) => grupoDoTipo(tipo, declarados, motivosDoCatalogo, escolhidos))
    .filter((grupo) => grupo.declarado || grupo.motivos.length > 0)
    .sort((um, outro) => Number(outro.declarado) - Number(um.declarado));
}

/** Os tipos que têm motivo escolhido e que a fase ou etapa não declara, na ordem do vocabulário. */
export function tiposEscolhidosNaoDeclarados(
  escolhidos: readonly MotivoNoDocumento[],
  declarados: readonly string[],
  vocabulario: readonly ItemDeVocabulario[],
): readonly string[] {
  const escolhidosPorTipo = new Set(escolhidos.map((motivo) => motivo.tipoCodigo));
  return opcoesDoVocabulario(vocabulario, [...escolhidosPorTipo].sort())
    .map((tipo) => tipo.codigo)
    .filter((codigo) => escolhidosPorTipo.has(codigo) && !declarados.includes(codigo));
}
