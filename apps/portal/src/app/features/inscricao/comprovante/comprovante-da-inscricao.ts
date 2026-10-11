import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';
import { titulosDasOcorrencias } from '@uniplus/shared-ui/components';

import { type CampoExibido, type NomesDosMunicipios, respostaExibida } from './resposta-exibida';

export interface RespostaDoComprovante {
  readonly rotulo: string;
  readonly valor: string;
}

export interface OcorrenciaDoComprovante {
  /** "Você (candidato)" ou "Integrante {n}", como no formulário. */
  readonly titulo: string;
  readonly respostas: readonly RespostaDoComprovante[];
}

export interface GrupoDoComprovante {
  readonly rotulo: string;
  readonly ocorrencias: readonly OcorrenciaDoComprovante[];
}

export interface SecaoDoComprovante {
  readonly codigo: string;
  readonly titulo: string;
  readonly respostas: readonly RespostaDoComprovante[];
  readonly grupos: readonly GrupoDoComprovante[];
}

interface CampoDoFormulario extends CampoExibido {
  readonly fatoCodigo: string;
  readonly rotulo: string;
}

/**
 * Os fatos do conjunto básico que o cartão do candidato já mostra: não se repetem nas respostas. São os
 * mesmos de que a API tira o nome preferido.
 */
const FATOS_DO_CARTAO_DO_CANDIDATO = new Set(['NOME', 'NOME_SOCIAL', 'DESEJA_NOME_SOCIAL', 'CPF']);

const pelaOrdem = <T extends { readonly ordem: number | string }>(itens: readonly T[]): T[] =>
  [...itens].sort((a, b) => Number(a.ordem) - Number(b.ordem));

const respondido = (respostas: Readonly<Record<string, unknown>>, fato: string): boolean =>
  respostas[fato] !== undefined && respostas[fato] !== null;

/**
 * Os derivados que o formulário descreve: os fatos que as regras do processo citam, com o rótulo e o
 * tipo congelados na publicação. O que o sistema calcula sem regra que o cite fica no comprovante
 * gravado, mas não tem como ser apresentado.
 */
const derivadosDescritos = (formulario: FormularioRenderizavelDto): CampoDoFormulario[] =>
  formulario.pressupostos.flatMap((p) => (p.rotulo ? [{ ...p, rotulo: p.rotulo }] : []));

function respondidos(
  campos: readonly CampoDoFormulario[],
  respostas: Readonly<Record<string, unknown>>,
  municipios: NomesDosMunicipios,
): RespostaDoComprovante[] {
  return campos
    .filter((c) => respondido(respostas, c.fatoCodigo))
    .map((c) => ({
      rotulo: c.rotulo,
      valor: respostaExibida(c, respostas[c.fatoCodigo], municipios),
    }));
}

/**
 * Os códigos IBGE distintos que o comprovante mostra como município: os das respostas e dos derivados
 * cujo campo, no formulário da versão fixada, é de município.
 */
export function municipiosDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
): string[] {
  const deMunicipio = (c: CampoExibido): boolean => c.tipoRenderizacao === 'MUNICIPIO';
  const codigos = (
    campos: readonly CampoDoFormulario[],
    respostas: Readonly<Record<string, unknown>>,
  ) =>
    campos
      .filter((c) => deMunicipio(c) && respondido(respostas, c.fatoCodigo))
      .map((c) => String(respostas[c.fatoCodigo]));
  return [
    ...new Set([
      ...codigos(formulario.fatosColetados, comprovante.respostas),
      ...formulario.grupos.flatMap((g) =>
        (comprovante.grupos[g.codigo] ?? []).flatMap((o) => codigos(g.subitens, o.respostas ?? {})),
      ),
      ...codigos(derivadosDescritos(formulario), comprovante.derivados),
    ]),
  ];
}

/** As respostas do comprovante pelas seções do formulário da versão fixada, com os rótulos de lá. */
export function secoesDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
  municipios: NomesDosMunicipios = new Map(),
): SecaoDoComprovante[] {
  return pelaOrdem(formulario.etapas)
    .map((etapa) => ({
      codigo: etapa.codigo,
      titulo: etapa.titulo,
      respostas: respondidos(
        pelaOrdem(
          formulario.fatosColetados.filter(
            (c) =>
              c.etapaCodigo === etapa.codigo && !FATOS_DO_CARTAO_DO_CANDIDATO.has(c.fatoCodigo),
          ),
        ),
        comprovante.respostas,
        municipios,
      ),
      grupos: pelaOrdem(formulario.grupos.filter((g) => g.etapaCodigo === etapa.codigo))
        .map((grupo) => {
          const ocorrencias = comprovante.grupos[grupo.codigo] ?? [];
          const titulos = titulosDasOcorrencias(
            grupo.incluiCandidato,
            ocorrencias.map((o) => o.respostas),
          );
          return {
            rotulo: grupo.rotulo,
            ocorrencias: ocorrencias.map((o, i) => ({
              titulo: titulos[i],
              respostas: respondidos(pelaOrdem(grupo.subitens), o.respostas ?? {}, municipios),
            })),
          };
        })
        .filter((g) => g.ocorrencias.length > 0),
    }))
    .filter((s) => s.respostas.length > 0 || s.grupos.length > 0);
}

/** O que o sistema calculou das respostas e o formulário descreve, com o rótulo de lá. */
export function derivadosDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
  municipios: NomesDosMunicipios = new Map(),
): RespostaDoComprovante[] {
  return respondidos(derivadosDescritos(formulario), comprovante.derivados, municipios);
}

/** Os termos aceitos pelo nome que o formulário lhes dá. */
export function termosAceitos(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
): string[] {
  const termos = new Map(formulario.termos.map((t) => [t.codigo, t.nome]));
  return comprovante.aceites.map((a) => termos.get(a.codigo) ?? a.codigo);
}

type ComprovanteEmitido = MinhaInscricaoDto['comprovantes'][number];

export interface Vizinhos {
  readonly anterior: number | null;
  readonly seguinte: number | null;
}

/** O número pedido, se a inscrição o emitiu; sem pedido, o da última submissão. */
export function numeroDoComprovante(
  emitidos: readonly ComprovanteEmitido[],
  pedido: number | null,
): number | null {
  const numeros = emitidos.map((e) => Number(e.numero));
  if (pedido === null) return numeros.at(-1) ?? null;
  return numeros.includes(pedido) ? pedido : null;
}

/** O comprovante anterior e o seguinte, na ordem em que foram emitidos. */
export function vizinhos(emitidos: readonly ComprovanteEmitido[], numero: number): Vizinhos {
  const numeros = emitidos.map((e) => Number(e.numero));
  const i = numeros.indexOf(numero);
  return { anterior: numeros[i - 1] ?? null, seguinte: numeros[i + 1] ?? null };
}

/** Qual envio da inscrição o comprovante registra, e se é o que vale: o último enviado (UNI-REQ-0132). */
export interface EnvioDoComprovante {
  readonly ordem: number;
  readonly total: number;
  readonly ehOQueVale: boolean;
  readonly maisRecente: number;
}

export function envioDoComprovante(
  emitidos: readonly ComprovanteEmitido[],
  numero: number,
): EnvioDoComprovante {
  const numeros = emitidos.map((e) => Number(e.numero));
  const maisRecente = numeros.at(-1) ?? numero;
  return {
    ordem: numeros.indexOf(numero) + 1,
    total: numeros.length,
    ehOQueVale: numero === maisRecente,
    maisRecente,
  };
}

/** A inscrição enviada ainda se corrige até o fim do período de inscrição. */
export function periodoDeInscricaoAberto(fim: string, agora: Date): boolean {
  return agora.getTime() <= new Date(fim).getTime();
}
