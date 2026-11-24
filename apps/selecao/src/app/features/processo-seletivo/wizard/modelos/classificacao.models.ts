/**
 * Uma regra de eliminação no rascunho, no shape do `esquema_args` que
 * `DefinirClassificacaoCommandHandler.MontarArgs` valida por código: `ELIMINACAO_NOTA_MINIMA_ETAPA`
 * usa `etapaRef` + `notaMinima`; `ELIMINACAO_CORTE_EM_AREA` usa `areaCodigo` + `minimo`;
 * `ELIMINACAO_ZERO_EM_AREA` não usa nenhuma. As colunas ficam sempre presentes, e o mapeador para o
 * comando decide qual vale por `regraCodigo`: trocar de regra sem perder o digitado simplifica a
 * tela sem violar a invariante do servidor.
 */
export interface RegraEliminacaoConfigurada {
  readonly regraCodigo: string;
  readonly regraVersao: string;
  /** Id de uma etapa pontuada do processo (`EtapaPontuada.id`). */
  readonly etapaRef: string;
  readonly notaMinima: string;
  readonly minimo: string;
  /** Código da área do ENEM do corte — uma das áreas presentes em todos os grupos do quadro. */
  readonly areaCodigo: string;
}

/**
 * Um critério de desempate no rascunho, no shape de `ArgsCriterioDesempate` por código:
 * `DESEMPATE_MAIOR_NOTA_ETAPA` usa `etapaRef`; `DESEMPATE_IDOSO`, `idadeMinima`;
 * `DESEMPATE_CONDICAO_SOBRE_DADO`, `fato` + `operador` + `valor`; `DESEMPATE_MAIOR_NOTA_AREA_ENEM`,
 * `areas` (códigos na ordem em que desempatam); `DESEMPATE_MAIOR_IDADE` não usa nenhum. A ordem é
 * a posição do item na lista do rascunho.
 */
export interface CriterioDesempateConfigurado {
  readonly regraCodigo: string;
  readonly regraVersao: string;
  readonly etapaRef: string;
  readonly idadeMinima: string;
  readonly fato: string;
  readonly operador: string;
  readonly valor: string;
  readonly areas: readonly string[];
}
