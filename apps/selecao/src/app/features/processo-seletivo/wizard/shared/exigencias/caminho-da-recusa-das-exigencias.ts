import type { OrigemDaRegraEnviada } from './gravacao-das-exigencias';

export interface CaminhoDaRecusaDasExigencias {
  readonly indiceDaRegra: number;
  readonly indicesDosItens: readonly number[];
  readonly campo: string;
}

export interface IdentificacaoDaRecusaDaExigencia {
  readonly identificadorDaRegra: string;
  readonly faseCodigo?: string;
  readonly campo: string;
}

function caminhoEmPontos(caminho: string): string {
  return caminho.startsWith('/')
    ? caminho
        .replace(/\/(\d+)/g, '[$1]')
        .replace(/\//g, '.')
        .replace(/^\./, '')
    : caminho.replace(/^(?:\$\.|request\.)/i, '');
}

export function caminhoDaRecusaDasExigencias(caminho: string): CaminhoDaRecusaDasExigencias | null {
  const emPontos = caminhoEmPontos(caminho);
  const partes =
    /^regrasDeComprovacao\[(\d+)\]((?:\.itens\[\d+\])*)\.(\w+(?:\[\d+\])?(?:\.\w+(?:\[\d+\])?)*)$/i.exec(
      emPontos,
    );
  if (partes === null) return null;
  return {
    indiceDaRegra: Number(partes[1]),
    indicesDosItens: [...partes[2].matchAll(/\.itens\[(\d+)\]/gi)].map((item) => Number(item[1])),
    campo: partes[3],
  };
}

export function identificarRecusaDaExigencia(
  caminho: string,
  origens: readonly OrigemDaRegraEnviada[],
): IdentificacaoDaRecusaDaExigencia | null {
  const local = caminhoDaRecusaDasExigencias(caminho);
  if (local === null) return null;
  let origem = origens[local.indiceDaRegra];
  for (const indice of local.indicesDosItens) origem = origem?.itens[indice];
  if (origem === undefined) return null;
  return {
    identificadorDaRegra: origem.identificadorDaRegra,
    campo: local.campo,
    ...(origem.faseCodigo ? { faseCodigo: origem.faseCodigo } : {}),
  };
}
