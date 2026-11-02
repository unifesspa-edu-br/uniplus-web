import type { MunicipioGravado } from '@uniplus/shared-utils';

import { nomeComUf, nomeDoMunicipioNaoCarregado } from '../editor-de-condicoes/valor-de-municipio';
import { ufDoCodigoIbge } from './interpretador/formatos';
import type { SimulacaoDoFormulario, ValorJson } from './interpretador/regras-do-formulario';

/** O município de uma resposta: o código e, na inscrição enviada, o nome gravado no envio. */
export interface MunicipioLido {
  readonly codigo: string;
  readonly rotulo: string | null;
}

/**
 * Lê o valor de um campo de município: o código em texto (rascunho) ou `{ codigo, rotulo }` (inscrição
 * enviada). Nulo para o que não é município.
 */
export function lerMunicipio(valor: unknown): MunicipioLido | null {
  if (typeof valor === 'string') return valor === '' ? null : { codigo: valor, rotulo: null };
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const { codigo, rotulo } = valor as Partial<Record<keyof MunicipioGravado, unknown>>;
  if (typeof codigo !== 'string' || codigo === '') return null;
  return { codigo, rotulo: typeof rotulo === 'string' && rotulo !== '' ? rotulo : null };
}

/** O que o comprovante mostra: o nome gravado, ou o aviso de nome não carregado quando falta. */
export function municipioParaExibir(municipio: MunicipioLido): string {
  return municipio.rotulo ?? nomeDoMunicipioNaoCarregado(municipio.codigo);
}

/** Os municípios gravados da inscrição, pela chave da resposta (`chaveDaResposta`). */
export type MunicipiosGravados = Readonly<Record<string, MunicipioGravado>>;

/** A chave da resposta: o fato, ou `grupo.ocorrência.fato` dentro de um grupo. */
export function chaveDaResposta(fato: string, ocorrencia?: { grupo: string; id: string }): string {
  return ocorrencia ? `${ocorrencia.grupo}.${ocorrencia.id}.${fato}` : fato;
}

/**
 * O nome gravado com a UF do código, "Salvador (BA)", enquanto o código da resposta for o gravado;
 * nulo quando a resposta não tem nome gravado ou o candidato escolheu outro município.
 */
export function rotuloGravadoDa(
  gravados: MunicipiosGravados,
  chave: string,
  codigoAtual: ValorJson | undefined,
): string | null {
  const gravado = gravados[chave];
  if (!gravado || gravado.codigo !== codigoAtual) return null;
  const uf = ufDoCodigoIbge(gravado.codigo);
  return uf ? nomeComUf(gravado.rotulo, uf) : gravado.rotulo;
}

interface CampoDoFormulario {
  readonly fatoCodigo: string;
  readonly tipoRenderizacao?: string | null;
}

/** O que o formulário diz de onde há município: os fatos coletados e os subitens de cada grupo. */
export interface FormularioComMunicipios {
  readonly fatosColetados: readonly CampoDoFormulario[];
  readonly grupos: readonly {
    readonly codigo: string;
    readonly subitens: readonly CampoDoFormulario[];
  }[];
}

export interface RespostasComMunicipios {
  readonly respostas: Readonly<Record<string, ValorJson>>;
  readonly grupos: NonNullable<SimulacaoDoFormulario['grupos']>;
}

export interface MunicipiosSeparados extends RespostasComMunicipios {
  readonly gravados: MunicipiosGravados;
  /** Os códigos que chegaram sem nome gravado, para quem hospeda dar nome. */
  readonly semNome: readonly string[];
}

const deMunicipio = (campo: CampoDoFormulario): boolean => campo.tipoRenderizacao === 'MUNICIPIO';

/**
 * Reduz todo município das respostas e dos subitens de grupo ao código, que é o que o campo e o envio
 * usam, e guarda à parte o nome gravado de cada resposta. Quem decide o que é município é a definição
 * do campo, e não a forma do valor: o endereço também é objeto.
 */
export function separarMunicipiosGravados(
  formulario: FormularioComMunicipios,
  entrada: RespostasComMunicipios,
): MunicipiosSeparados {
  const gravados: Record<string, MunicipioGravado> = {};
  const semNome: string[] = [];

  const reduzir = (
    campos: readonly CampoDoFormulario[],
    respostas: Readonly<Record<string, ValorJson>>,
    ocorrencia?: { grupo: string; id: string },
  ): Readonly<Record<string, ValorJson>> => {
    const reduzidas = { ...respostas };
    for (const campo of campos.filter(deMunicipio)) {
      const municipio = lerMunicipio(respostas[campo.fatoCodigo]);
      if (!municipio) continue;
      reduzidas[campo.fatoCodigo] = municipio.codigo;
      if (municipio.rotulo === null) semNome.push(municipio.codigo);
      else
        gravados[chaveDaResposta(campo.fatoCodigo, ocorrencia)] = {
          codigo: municipio.codigo,
          rotulo: municipio.rotulo,
        };
    }
    return reduzidas;
  };

  const subitensDe = new Map(formulario.grupos.map((g) => [g.codigo, g.subitens]));
  return {
    respostas: reduzir(formulario.fatosColetados, entrada.respostas),
    grupos: Object.fromEntries(
      Object.entries(entrada.grupos).map(([grupo, ocorrencias]) => [
        grupo,
        ocorrencias?.map((o) => ({
          ...o,
          respostas: reduzir(subitensDe.get(grupo) ?? [], o.respostas ?? {}, {
            grupo,
            id: o.id,
          }),
        })) ?? null,
      ]),
    ),
    gravados,
    semNome,
  };
}
