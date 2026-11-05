import type { CampoAvaliado } from './interpretador/regras-do-formulario';
import type { CampoRenderizavel, ValorSelecionavel } from './formulario-do-candidato.model';

/** Uma opção do campo de escolha; a já escolhida que as regras deixaram de permitir vem marcada. */
export interface OpcaoDoCampo extends ValorSelecionavel {
  readonly foraDasOpcoes?: boolean;
}

/**
 * As opções que o campo de escolha mostra: as vigentes, quando as regras as limitam, com a descrição do
 * valor quando ele é conhecido; senão, os valores do campo. A resposta já dada que as regras deixaram de
 * permitir continua na lista, marcada, para o candidato poder desfazê-la.
 */
export function opcoesDoCampo(
  campo: CampoRenderizavel,
  avaliado: CampoAvaliado,
  escolhidos: readonly string[] = [],
): readonly OpcaoDoCampo[] {
  const valores = [...(campo.valoresSelecionaveis ?? [])].sort(
    (a, b) => a.ordem - b.ordem || (a.codigo < b.codigo ? -1 : 1),
  );
  const porCodigo = new Map(valores.map((v) => [v.codigo, v]));
  const opcoes = avaliado.opcoes ? opcoesVigentes(valores, avaliado.opcoes.codigos ?? []) : valores;
  const mostradas = new Set(opcoes.map((o) => o.codigo));
  const foraDasOpcoes = escolhidos
    .filter((c) => !mostradas.has(c))
    .map((codigo, i) => ({
      ...(porCodigo.get(codigo) ?? { codigo, descricao: null }),
      ordem: valores.length + opcoes.length + i,
      foraDasOpcoes: true,
    }));
  return [...opcoes, ...foraDasOpcoes];
}

/** Os valores conhecidos que as regras permitem e, depois, os códigos permitidos que o campo não conhece. */
function opcoesVigentes(
  valores: readonly ValorSelecionavel[],
  codigos: readonly string[],
): OpcaoDoCampo[] {
  const vigentes = new Set(codigos);
  const conhecidos = new Set(valores.map((v) => v.codigo));
  return [
    ...valores.filter((v) => vigentes.has(v.codigo)),
    ...codigos
      .filter((c) => !conhecidos.has(c))
      .map((codigo, i) => ({ codigo, descricao: null, ordem: valores.length + i })),
  ];
}
