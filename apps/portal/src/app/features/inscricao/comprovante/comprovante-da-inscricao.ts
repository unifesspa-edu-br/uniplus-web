import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
  MinhaInscricaoDto,
} from '@uniplus/shared-data/selecao';

import { type CampoExibido, respostaExibida } from './resposta-exibida';

export interface RespostaDoComprovante {
  readonly rotulo: string;
  readonly valor: string;
}

export interface GrupoDoComprovante {
  readonly rotulo: string;
  readonly ocorrencias: readonly (readonly RespostaDoComprovante[])[];
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

const pelaOrdem = <T extends { readonly ordem: number | string }>(itens: readonly T[]): T[] =>
  [...itens].sort((a, b) => Number(a.ordem) - Number(b.ordem));

function respondidos(
  campos: readonly CampoDoFormulario[],
  respostas: Readonly<Record<string, unknown>>,
): RespostaDoComprovante[] {
  return campos
    .filter((c) => respostas[c.fatoCodigo] !== undefined && respostas[c.fatoCodigo] !== null)
    .map((c) => ({ rotulo: c.rotulo, valor: respostaExibida(c, respostas[c.fatoCodigo]) }));
}

/** As respostas do comprovante pelas seções do formulário da versão fixada, com os rótulos de lá. */
export function secoesDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
): SecaoDoComprovante[] {
  return pelaOrdem(formulario.etapas)
    .map((etapa) => ({
      codigo: etapa.codigo,
      titulo: etapa.titulo,
      respostas: respondidos(
        pelaOrdem(formulario.fatosColetados.filter((c) => c.etapaCodigo === etapa.codigo)),
        comprovante.respostas,
      ),
      grupos: pelaOrdem(formulario.grupos.filter((g) => g.etapaCodigo === etapa.codigo))
        .map((grupo) => ({
          rotulo: grupo.rotulo,
          ocorrencias: (comprovante.grupos[grupo.codigo] ?? []).map((o) =>
            respondidos(pelaOrdem(grupo.subitens), o.respostas ?? {}),
          ),
        }))
        .filter((g) => g.ocorrencias.length > 0),
    }))
    .filter((s) => s.respostas.length > 0 || s.grupos.length > 0);
}

/** O que o sistema calculou das respostas, com o rótulo que o formulário dá ao fato. */
export function derivadosDoComprovante(
  formulario: FormularioRenderizavelDto,
  comprovante: ComprovanteInscricaoDto,
): RespostaDoComprovante[] {
  const pressupostos = new Map(formulario.pressupostos.map((p) => [p.fatoCodigo, p]));
  return Object.entries(comprovante.derivados).map(([fato, valor]) => {
    const pressuposto = pressupostos.get(fato);
    return {
      rotulo: pressuposto?.rotulo ?? fato,
      valor: respostaExibida(pressuposto ?? {}, valor),
    };
  });
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
