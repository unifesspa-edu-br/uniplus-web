import { segmentosDoPonteiro } from './segmentos-do-ponteiro';

/** Item de lista que o documento identifica por `chave` vira `{ chave }`; sem `chave`, é a posição. */
export type PassoDoEndereco = string | number | { readonly chave: string };

export interface EnderecoNaTela {
  readonly caminho: readonly PassoDoEndereco[];
}

export type ResultadoDoEndereco =
  | { readonly resolvido: true; readonly endereco: EnderecoNaTela }
  | { readonly resolvido: false; readonly motivo: 'ponteiroInvalido' | 'foraDoDocumento' };

interface PassoResolvido {
  readonly valor: unknown;
  readonly passo: PassoDoEndereco;
}

const POSICAO_DE_LISTA = /^(0|[1-9]\d*)$/;

const FORA_DO_DOCUMENTO: ResultadoDoEndereco = { resolvido: false, motivo: 'foraDoDocumento' };

/**
 * Traduz o ponteiro de uma recusa da API no endereço do item, lendo o documento que foi enviado
 * naquele salvamento. Reordenar a lista depois do envio não muda o item apontado, porque a
 * posição vira a `chave` do item enquanto o documento enviado ainda está à mão.
 */
export function enderecoNaTela(documentoEnviado: unknown, ponteiro: string): ResultadoDoEndereco {
  const leitura = segmentosDoPonteiro(ponteiro);
  if (!leitura.lido) {
    return { resolvido: false, motivo: 'ponteiroInvalido' };
  }
  return percorrer(documentoEnviado, leitura.segmentos);
}

function percorrer(documentoEnviado: unknown, segmentos: readonly string[]): ResultadoDoEndereco {
  const caminho: PassoDoEndereco[] = [];
  let atual = documentoEnviado;
  for (const segmento of segmentos) {
    const resolvido = darPasso(atual, segmento);
    if (resolvido === null) {
      return FORA_DO_DOCUMENTO;
    }
    caminho.push(resolvido.passo);
    atual = resolvido.valor;
  }
  return { resolvido: true, endereco: { caminho } };
}

function darPasso(atual: unknown, segmento: string): PassoResolvido | null {
  if (Array.isArray(atual)) {
    return passoDeLista(atual, segmento);
  }
  return ehObjeto(atual) ? passoDeObjeto(atual, segmento) : null;
}

function passoDeLista(lista: readonly unknown[], segmento: string): PassoResolvido | null {
  if (!POSICAO_DE_LISTA.test(segmento)) {
    return null;
  }
  const posicao = Number(segmento);
  if (!Object.hasOwn(lista, posicao)) {
    return null;
  }
  const item = lista[posicao];
  return { valor: item, passo: ehObjetoComChave(item) ? { chave: item.chave } : posicao };
}

function passoDeObjeto(objeto: Record<string, unknown>, segmento: string): PassoResolvido | null {
  return Object.hasOwn(objeto, segmento) ? { valor: objeto[segmento], passo: segmento } : null;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehObjetoComChave(valor: unknown): valor is { readonly chave: string } {
  return ehObjeto(valor) && Object.hasOwn(valor, 'chave') && typeof valor['chave'] === 'string';
}
