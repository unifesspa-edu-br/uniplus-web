import { GRUPO_E, GRUPO_OU } from './documentos-avaliados';
import type { GrupoDeDocumentos, NoDeDocumentos } from './arvore-de-documentos';

/** O grupo em que bastam algumas das alternativas. */
export function ehEscolha(no: GrupoDeDocumentos): boolean {
  return no.tipo === GRUPO_OU && no.minimo < no.itens.length;
}

export interface TextoDaUnidade {
  readonly texto: string;
  /** Junta mais de um item: entre outros, pede delimitação. */
  readonly composto: boolean;
}

/**
 * Como a unidade se diz: o documento pelo nome, o conjunto com "e", a escolha com "ou" — "2 entre A, B
 * e C" no N-de —, com a parte aninhada delimitada: "RG ou CNH, ou Passaporte".
 */
export function textoDaUnidade(no: NoDeDocumentos): TextoDaUnidade {
  if (no.tipo === 'DOCUMENTO') return { texto: no.documento.rotulo, composto: false };
  const partes = no.itens.map(textoDaUnidade);
  if (partes.length === 1) return partes[0];
  const algumComposto = partes.some((p) => p.composto);
  const separador = algumComposto ? '; ' : ', ';
  const ultimo = algumComposto ? '; e ' : ' e ';
  if (!ehEscolha(no)) return { texto: juntar(partes, separador, ultimo), composto: true };
  if (no.minimo > 1)
    return { texto: `${no.minimo} entre ${juntar(partes, separador, ultimo)}`, composto: true };
  return { texto: juntarComOu(partes), composto: true };
}

function juntarComOu(partes: readonly TextoDaUnidade[]): string {
  return partes.reduce(
    (dito, parte, i) =>
      i === 0
        ? parte.texto
        : `${dito}${parte.composto || partes[i - 1].composto ? ', ou ' : ' ou '}${parte.texto}`,
    '',
  );
}

function juntar(partes: readonly TextoDaUnidade[], separador: string, ultimo: string): string {
  const textos = partes.map((p) => p.texto);
  return textos.length === 1
    ? textos[0]
    : `${textos.slice(0, -1).join(separador)}${ultimo}${textos.at(-1)}`;
}

/** O que a escolha de um grupo diz ao candidato. */
export function textoDoGrupo(no: GrupoDeDocumentos): string {
  if (no.deCadaIntegrante) return 'De cada integrante:';
  const texto = textoDaEscolha(no);
  return no.integrante === null ? texto : `${no.integrante}: ${texto}`;
}

function textoDaEscolha(no: GrupoDeDocumentos): string {
  const total = no.itens.length;
  if (no.tipo === GRUPO_E || no.minimo >= total) {
    return total === 1 ? 'Envie o documento abaixo:' : 'Envie todos estes documentos, juntos:';
  }
  const soDocumentos = no.itens.every((i) => i.tipo === 'DOCUMENTO');
  if (no.minimo === 1) {
    return soDocumentos
      ? 'Envie um dos documentos abaixo, à sua escolha:'
      : 'Envie uma das opções abaixo, à sua escolha:';
  }
  return soDocumentos
    ? `Envie ${no.minimo} dos documentos abaixo, à sua escolha:`
    : `Envie ${no.minimo} das opções abaixo, à sua escolha:`;
}
