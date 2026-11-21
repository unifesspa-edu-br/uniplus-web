/** O que cita o fato e deixaria de valer, agrupado pelo tipo de citação que a API informa. */
export interface GrupoDeCitacoes {
  readonly tipo: string;
  readonly titulo: string;
  readonly itens: readonly { readonly codigo: string; readonly mensagem: string }[];
}

const TITULOS_DE_CITACAO: readonly (readonly [string, string])[] = [
  ['regrasPadrao', 'Regras padrão de outros fatos'],
  ['agregados', 'Resumos de grupo'],
  ['modelos', 'Modelos de formulário'],
  ['modalidades', 'Regras de aplicabilidade de modalidades'],
];

/** Agrupa as recusas de `citacoes.<tipo>.<código>`; as demais recusas não são citações. */
export function citacoesDaRecusa(
  erros: readonly { field: string; message: string }[],
): readonly GrupoDeCitacoes[] {
  const porTipo = citacoesPorTipo(erros);
  const conhecidos = TITULOS_DE_CITACAO.filter(([tipo]) => porTipo.has(tipo)).map(
    ([tipo, titulo]) => ({ tipo, titulo, itens: porTipo.get(tipo) ?? [] }),
  );
  // Um tipo que a tela ainda não conhece não pode sumir: a alteração foi recusada por causa dele.
  const desconhecidos = [...porTipo.entries()]
    .filter(([tipo]) => !TITULOS_DE_CITACAO.some(([conhecido]) => conhecido === tipo))
    .map(([tipo, itens]) => ({ tipo, titulo: 'Outras citações', itens }));
  return [...conhecidos, ...desconhecidos];
}

function citacoesPorTipo(
  erros: readonly { field: string; message: string }[],
): Map<string, { codigo: string; mensagem: string }[]> {
  const porTipo = new Map<string, { codigo: string; mensagem: string }[]>();
  for (const erro of erros) {
    const encontrado = /^citacoes\.([^.]+)\.(.+)$/u.exec(erro.field);
    if (encontrado === null) continue;
    const itens = porTipo.get(encontrado[1]) ?? [];
    itens.push({ codigo: encontrado[2], mensagem: erro.message });
    porTipo.set(encontrado[1], itens);
  }
  return porTipo;
}

/** Se a recusa é de uma citação, e não de um campo do formulário. */
export function ehCitacao(campo: string): boolean {
  return campo.startsWith('citacoes.');
}
