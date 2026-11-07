import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  GrupoAvaliado,
  OcorrenciaAvaliada,
} from './interpretador/regras-do-formulario';

/**
 * O que o interpretador decidiu diferente do servidor, ao conferir a simulação com a avaliação sem
 * cadastro da API. A API é a autoridade: uma divergência é regra que o front lê de outro jeito, e vale
 * virar caso do corpus compartilhado.
 */
export interface Divergencia {
  /** Onde: a etapa, o campo, o grupo, a ocorrência ou o termo, pelo código. */
  readonly onde: string;
  readonly propriedade: string;
  readonly interpretador: string;
  readonly servidor: string;
}

const CAMPO: readonly (keyof CampoAvaliado)[] = [
  'estado',
  'visivel',
  'obrigatorio',
  'restricoesVioladas',
  'impedido',
  'opcoes',
];

const GRUPO: readonly (keyof GrupoAvaliado)[] = [
  'visivel',
  'obrigatorio',
  'estado',
  'contagemValida',
  'ocorrenciaDoCandidatoValida',
];

/** Dois lados da mesma coleção, casados pela chave; cada item sem par chega com o outro lado ausente. */
interface Pareamento<T> {
  readonly meus: readonly T[];
  readonly deles: readonly T[];
  readonly chave: (item: T) => string;
  readonly rotulo: string;
  readonly conferir: (onde: string, meu?: T, dele?: T) => void;
}

function parear<T>({ meus, deles, chave, rotulo, conferir }: Pareamento<T>): void {
  const mapa = new Map(deles.map((item) => [chave(item), item]));
  const vistos = new Set<string>();
  for (const meu of meus) {
    vistos.add(chave(meu));
    conferir(`${rotulo} ${chave(meu)}`, meu, mapa.get(chave(meu)));
  }
  for (const dele of deles)
    if (!vistos.has(chave(dele))) conferir(`${rotulo} ${chave(dele)}`, undefined, dele);
}

class ConferenciaDasAvaliacoes {
  readonly divergencias: Divergencia[] = [];

  etapas(meus: AvaliacaoDoFormulario['etapas'], deles: AvaliacaoDoFormulario['etapas']): void {
    parear({
      meus,
      deles,
      chave: (e) => e.codigo,
      rotulo: 'Etapa',
      conferir: (onde, meu, dele) => this.comparar(onde, 'visivel', meu?.visivel, dele?.visivel),
    });
  }

  campos(prefixo: string, meus: readonly CampoAvaliado[], deles: readonly CampoAvaliado[]): void {
    parear({
      meus,
      deles,
      chave: (c) => c.fatoCodigo,
      rotulo: `${prefixo}Campo`,
      conferir: (onde, meu, dele) =>
        CAMPO.forEach((p) => this.comparar(onde, p, meu?.[p], dele?.[p])),
    });
  }

  grupos(meus: AvaliacaoDoFormulario['grupos'], deles: AvaliacaoDoFormulario['grupos']): void {
    parear({
      meus,
      deles,
      chave: (g) => g.codigo,
      rotulo: 'Grupo',
      conferir: (onde, meu, dele) => {
        GRUPO.forEach((p) => this.comparar(onde, p, meu?.[p], dele?.[p]));
        this.ocorrencias(onde, meu?.ocorrencias ?? [], dele?.ocorrencias ?? []);
      },
    });
  }

  termos(meus: AvaliacaoDoFormulario['termos'], deles: AvaliacaoDoFormulario['termos']): void {
    parear({
      meus,
      deles,
      chave: (t) => t.codigo,
      rotulo: 'Termo',
      conferir: (onde, meu, dele) => {
        this.comparar(onde, 'visivel', meu?.visivel, dele?.visivel);
        this.comparar(onde, 'obrigatorio', meu?.obrigatorio, dele?.obrigatorio);
      },
    });
  }

  private ocorrencias(
    doGrupo: string,
    meus: readonly OcorrenciaAvaliada[],
    deles: readonly OcorrenciaAvaliada[],
  ): void {
    parear({
      meus,
      deles,
      chave: (o) => o.id,
      rotulo: `${doGrupo}, ocorrência`,
      conferir: (daOcorrencia, minha, dela) => {
        this.comparar(daOcorrencia, 'estado', minha?.estado, dela?.estado);
        this.campos(`${daOcorrencia}, `, minha?.campos ?? [], dela?.campos ?? []);
      },
    });
  }

  private comparar(onde: string, propriedade: string, deLa: unknown, daqui: unknown): void {
    const interpretador = JSON.stringify(normalizar(deLa)) ?? 'ausente';
    const servidor = JSON.stringify(normalizar(daqui)) ?? 'ausente';
    if (interpretador !== servidor)
      this.divergencias.push({ onde, propriedade, interpretador, servidor });
  }
}

export function divergenciasEntre(
  local: AvaliacaoDoFormulario,
  servidor: AvaliacaoDoFormulario,
): Divergencia[] {
  const conferencia = new ConferenciaDasAvaliacoes();
  conferencia.etapas(local.etapas, servidor.etapas);
  conferencia.campos('', local.campos, servidor.campos);
  conferencia.grupos(local.grupos, servidor.grupos);
  conferencia.termos(local.termos, servidor.termos);
  return conferencia.divergencias;
}

/** As opções e as restrições violadas são conjuntos: a ordem não conta. */
function normalizar(valor: unknown): unknown {
  if (Array.isArray(valor))
    return [...valor]
      .map(normalizar)
      .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, normalizar(v)]),
    );
  }
  return valor;
}
