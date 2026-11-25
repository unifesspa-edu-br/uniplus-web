import { compararOrdinal } from './interpretador/restricoes';
import type { CampoAvaliado } from './interpretador/regras-do-formulario';
import type { CampoApresentado, ValorSelecionavel } from './formulario-do-candidato.model';

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
  campo: CampoApresentado,
  avaliado: CampoAvaliado,
  escolhidos: readonly string[] = [],
): readonly OpcaoDoCampo[] {
  const valores = valoresNaOrdem(campo);
  const opcoes = avaliado.opcoes ? opcoesVigentes(valores, avaliado.opcoes.codigos ?? []) : valores;
  return [...opcoes, ...escolhidasForaDasOpcoes(escolhidos, opcoes, valores)];
}

function valoresNaOrdem(campo: CampoApresentado): ValorSelecionavel[] {
  return [...(campo.valoresSelecionaveis ?? [])].sort(
    (a, b) => a.ordem - b.ordem || compararOrdinal(a.codigo, b.codigo),
  );
}

function escolhidasForaDasOpcoes(
  escolhidos: readonly string[],
  opcoes: readonly OpcaoDoCampo[],
  valores: readonly ValorSelecionavel[],
): OpcaoDoCampo[] {
  const porCodigo = new Map(valores.map((valor) => [valor.codigo, valor]));
  const mostradas = new Set(opcoes.map((opcao) => opcao.codigo));
  return escolhidos
    .filter((codigo) => !mostradas.has(codigo))
    .map((codigo, indice) => ({
      ...(porCodigo.get(codigo) ?? { codigo, descricao: null }),
      ordem: valores.length + opcoes.length + indice,
      foraDasOpcoes: true,
    }));
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
