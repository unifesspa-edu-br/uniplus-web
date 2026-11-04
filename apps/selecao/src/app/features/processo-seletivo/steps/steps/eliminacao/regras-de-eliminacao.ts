import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

import type { ClassificacaoGravada } from '../../classificacao-no-servidor';
import type {
  EtapaPontuada,
  RegraEliminacaoConfigurada,
  WizardDraft,
} from '../../processo-seletivo.models';
import {
  areasComunsAoQuadro,
  corteDaArea,
  ordemDasAreas,
  type ColunaDoQuadro,
  type GrupoDoQuadro,
} from '../../shared/quadro-de-pesos';
import type { LeituraDoCadastro } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import {
  eliminacaoUsaAreaEMinimo,
  eliminacaoUsaEtapa,
  eliminacaoUsaEtapaENotaMinima,
  eliminacaoUsaSoEtapa,
  exigeResolucaoPesoAreaEnem,
} from '../classificacao/classificacao-para-comando';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import { rotulosDasAreas } from '../desempate/situacao-do-quadro';

/**
 * Uma etapa já persistida do cronograma, que uma regra pode citar por `etapaRef`. `doEnem` diz se
 * ela é a etapa de nota do ENEM, que o servidor julga pelo tipo que a gravação levaria.
 */
export type EtapaReferenciavel = EtapaPontuada & {
  readonly id: string;
  readonly doEnem: boolean;
};

/**
 * O que a Eliminação sabe do quadro de Peso por Área para oferecer e julgar cortes por área:
 * as áreas que um corte pode citar (`null` enquanto o quadro não é conhecido), os grupos do quadro
 * e os rótulos das áreas.
 */
export interface QuadroDoCorte {
  readonly areas: readonly ColunaDoQuadro[] | null;
  readonly grupos: readonly GrupoDoQuadro[];
  readonly rotulos: ReadonlyMap<string, string>;
}

export const REGRA_ELIMINACAO_VAZIA: RegraEliminacaoConfigurada = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  notaMinima: '',
  minimo: '',
  areaCodigo: '',
};

/**
 * O quadro contra o qual o servidor confere o corte: o que a gravação da classificação copia do
 * cadastro para a resolução do rascunho. Com o cadastro ainda não lido, a cópia gravada vale só
 * se for da mesma resolução — é o caso do processo só para consulta. Sem o quadro conhecido as
 * áreas são `null`; quando a classificação não usa a média ponderada do ENEM, qualquer área do
 * ENEM pode ter corte.
 */
export function quadroDoCorte(
  classificacao: WizardDraft['classificacao'],
  cadastro: LeituraDoCadastro,
  gravada: ClassificacaoGravada,
): QuadroDoCorte {
  const canonicas = cadastro.canonicas;
  if (!exigeResolucaoPesoAreaEnem(classificacao)) {
    return { areas: canonicas, grupos: [], rotulos: rotulosDasAreas(canonicas, []) };
  }

  const grupos = quadroConhecido(classificacao, cadastro, gravada);
  return {
    areas: grupos === null ? null : areasComunsAoQuadro(grupos, ordemDasAreas(canonicas)),
    grupos: grupos ?? [],
    rotulos: rotulosDasAreas(canonicas, grupos ?? []),
  };
}

function quadroConhecido(
  classificacao: WizardDraft['classificacao'],
  cadastro: LeituraDoCadastro,
  gravada: ClassificacaoGravada,
): readonly GrupoDoQuadro[] | null {
  if (cadastro.lido) return cadastro.quadroDaResolucaoEscolhida;
  return gravada.estado === 'com-quadro' &&
    gravada.resolucao === classificacao.resolucaoPesoAreaEnem
    ? gravada.grupos
    : null;
}

export function rotuloDaArea(quadro: QuadroDoCorte, codigo: string): string {
  return quadro.rotulos.get(codigo) ?? codigo;
}

/** O rótulo completo do mínimo, com a área: dois cortes lado a lado não se confundem. */
export function rotuloDoMinimo(regra: RegraEliminacaoConfigurada, quadro: QuadroDoCorte): string {
  return regra.areaCodigo === ''
    ? 'Nota mínima'
    : `Nota mínima em ${rotuloDaArea(quadro, regra.areaCodigo)}`;
}

/** O corte que a resolução dá à área, quando a classificação tem quadro e o cadastro foi lido. */
export function corteSugerido(
  regra: RegraEliminacaoConfigurada,
  quadro: QuadroDoCorte,
): number | null {
  if (regra.areaCodigo === '' || quadro.grupos.length === 0) return null;
  return corteDaArea(quadro.grupos, regra.areaCodigo);
}

/** A ausência só vale em etapa que nenhuma outra regra de ausência cita. */
export function citadaPorOutraAusencia(
  regras: readonly RegraEliminacaoConfigurada[],
  etapaId: string | null,
  indice: number,
): boolean {
  return regras.some(
    (outra, item) =>
      item !== indice && eliminacaoUsaSoEtapa(outra.regraCodigo) && outra.etapaRef === etapaId,
  );
}

/**
 * As etapas oferecidas à regra. A ausência só vale onde há prova a que faltar, e a etapa de nota
 * do ENEM não tem: fica de fora, e cada etapa é citada por uma regra só. A etapa gravada aparece
 * mesmo fora das oferecidas, como na área do corte: o operador vê o que está configurado.
 */
export function etapasEscolhiveis(
  regras: readonly RegraEliminacaoConfigurada[],
  etapas: readonly EtapaReferenciavel[],
  indice: number,
): readonly EtapaReferenciavel[] {
  const regra = regras[indice];
  if (!eliminacaoUsaSoEtapa(regra.regraCodigo)) return etapas;

  const oferecidas = etapas.filter(
    (etapa) => !etapa.doEnem && !citadaPorOutraAusencia(regras, etapa.id, indice),
  );
  const gravada = etapas.find((etapa) => etapa.id === regra.etapaRef);
  return gravada === undefined || oferecidas.includes(gravada)
    ? oferecidas
    : [gravada, ...oferecidas];
}

/** As áreas oferecidas à regra: as do corte, menos as que outro corte já cita (uma por área). */
export function areasEscolhiveis(
  regras: readonly RegraEliminacaoConfigurada[],
  quadro: QuadroDoCorte,
  indice: number,
): readonly ColunaDoQuadro[] {
  const citadasPorOutras = new Set(
    regras
      .filter((regra, item) => item !== indice && eliminacaoUsaAreaEMinimo(regra.regraCodigo))
      .map((regra) => regra.areaCodigo),
  );
  const oferecidas = (quadro.areas ?? []).filter((area) => !citadasPorOutras.has(area.codigo));
  // A área gravada aparece mesmo fora das oferecidas: o operador vê o que está configurado.
  const gravada = regras[indice]?.areaCodigo ?? '';
  return gravada === '' || oferecidas.some((area) => area.codigo === gravada)
    ? oferecidas
    : [{ codigo: gravada, rotulo: rotuloDaArea(quadro, gravada) }, ...oferecidas];
}

/**
 * Trocar de regra some com o que não se aplica mais ao shape novo — o operador não vê um campo
 * preenchido que a regra escolhida ignora.
 */
export function trocaDeRegra(chave: string): Partial<RegraEliminacaoConfigurada> {
  const { codigo, versao } = lerChaveDaRegra(chave);
  return {
    regraCodigo: codigo,
    regraVersao: versao,
    etapaRef: '',
    notaMinima: '',
    minimo: '',
    areaCodigo: '',
  };
}

/**
 * O corte do cadastro é sugestão, e a regra é a norma aplicada: o mínimo sugerido só entra quando
 * o operador ainda não informou um. O mínimo igual à sugestão da área anterior veio dela, e não do
 * operador, então também é trocado.
 */
export function trocaDeArea(
  regra: RegraEliminacaoConfigurada,
  areaCodigo: string,
  quadro: QuadroDoCorte,
): Partial<RegraEliminacaoConfigurada> {
  const anterior = corteSugerido(regra, quadro);
  const sugerido = corteSugerido({ ...regra, areaCodigo }, quadro);
  const minimo = regra.minimo.trim();
  const naoInformado = minimo === '' || (anterior !== null && minimo === String(anterior));
  return {
    areaCodigo,
    ...(naoInformado ? { minimo: sugerido === null ? '' : String(sugerido) } : {}),
  };
}

/** A regra como a consulta a mostra: os valores gravados, nomeados pelo que o operador vê. */
export function leituraDaRegra(
  regra: RegraEliminacaoConfigurada,
  catalogo: readonly RegraCatalogoDto[],
  etapas: readonly EtapaReferenciavel[],
  quadro: QuadroDoCorte,
) {
  const etapa = etapas.find((item) => item.id === regra.etapaRef);
  return {
    usaEtapa: eliminacaoUsaEtapa(regra.regraCodigo),
    usaEtapaENotaMinima: eliminacaoUsaEtapaENotaMinima(regra.regraCodigo),
    usaAreaEMinimo: eliminacaoUsaAreaEMinimo(regra.regraCodigo),
    rotuloDoMinimo: rotuloDoMinimo(regra, quadro),
    regra: rotuloDaRegraEscolhida(
      regrasEscolhiveis(catalogo, regra.regraCodigo, regra.regraVersao),
    ),
    etapa: etapa === undefined ? null : etapa.nome || 'Etapa sem nome',
    notaMinima: leituraDoCampoDecimal(regra.notaMinima),
    area: regra.areaCodigo === '' ? null : rotuloDaArea(quadro, regra.areaCodigo),
    minimo: leituraDoCampoDecimal(regra.minimo),
  };
}
