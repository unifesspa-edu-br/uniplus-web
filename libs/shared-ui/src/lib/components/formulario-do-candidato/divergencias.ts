import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
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

export function divergenciasEntre(
  local: AvaliacaoDoFormulario,
  servidor: AvaliacaoDoFormulario,
): Divergencia[] {
  const divergencias: Divergencia[] = [];
  const comparar = (onde: string, propriedade: string, deLa: unknown, daqui: unknown): void => {
    const interpretador = JSON.stringify(normalizar(deLa)) ?? 'ausente';
    const doServidor = JSON.stringify(normalizar(daqui)) ?? 'ausente';
    if (interpretador !== doServidor)
      divergencias.push({ onde, propriedade, interpretador, servidor: doServidor });
  };
  const porChave = <T>(lista: readonly T[], chave: (item: T) => string): ReadonlyMap<string, T> =>
    new Map(lista.map((item) => [chave(item), item]));
  const juntos = <T>(
    meus: readonly T[],
    deles: readonly T[],
    chave: (item: T) => string,
    conferir: (onde: string, meu?: T, dele?: T) => void,
    rotulo: string,
  ): void => {
    const mapa = porChave(deles, chave);
    const vistos = new Set<string>();
    for (const meu of meus) {
      vistos.add(chave(meu));
      conferir(`${rotulo} ${chave(meu)}`, meu, mapa.get(chave(meu)));
    }
    for (const dele of deles)
      if (!vistos.has(chave(dele))) conferir(`${rotulo} ${chave(dele)}`, undefined, dele);
  };
  const campos = (
    prefixo: string,
    meus: readonly CampoAvaliado[],
    deles: readonly CampoAvaliado[],
  ): void =>
    juntos(
      meus,
      deles,
      (c) => c.fatoCodigo,
      (onde, meu, dele) => CAMPO.forEach((p) => comparar(onde, p, meu?.[p], dele?.[p])),
      `${prefixo}Campo`,
    );

  juntos(
    local.etapas,
    servidor.etapas,
    (e) => e.codigo,
    (onde, meu, dele) => comparar(onde, 'visivel', meu?.visivel, dele?.visivel),
    'Etapa',
  );
  campos('', local.campos, servidor.campos);
  juntos(
    local.grupos,
    servidor.grupos,
    (g) => g.codigo,
    (onde, meu, dele) => {
      for (const p of [
        'visivel',
        'obrigatorio',
        'estado',
        'contagemValida',
        'ocorrenciaDoCandidatoValida',
      ] as const)
        comparar(onde, p, meu?.[p], dele?.[p]);
      juntos<OcorrenciaAvaliada>(
        meu?.ocorrencias ?? [],
        dele?.ocorrencias ?? [],
        (o) => o.id,
        (daOcorrencia, minha, dela) => {
          comparar(daOcorrencia, 'estado', minha?.estado, dela?.estado);
          campos(`${daOcorrencia}, `, minha?.campos ?? [], dela?.campos ?? []);
        },
        `${onde}, ocorrência`,
      );
    },
    'Grupo',
  );
  juntos(
    local.termos,
    servidor.termos,
    (t) => t.codigo,
    (onde, meu, dele) => {
      comparar(onde, 'visivel', meu?.visivel, dele?.visivel);
      comparar(onde, 'obrigatorio', meu?.obrigatorio, dele?.obrigatorio);
    },
    'Termo',
  );
  return divergencias;
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
