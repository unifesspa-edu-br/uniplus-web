/**
 * Distribuição de vagas de uma oferta de curso (UNI-REQ-0134). A oferta é referenciada pelo id do
 * catálogo de Configuração: curso, local, unidade e turnos são projeção dela, e remontá-los aqui
 * produziu o quadro fictício que este modelo substitui.
 *
 * Os números são texto porque é o que o campo edita: `Number` ao digitar leria `1.000` como 1
 * A conversão acontece no envio, com gramática explícita.
 */
export interface DistribuicaoDeVagas {
  readonly ofertaCursoId: string;
  readonly voBase: string;
  readonly pr: string;
  /**
   * Regra do `rol_de_regras`, por código **e** versão: versão nova do catálogo não pode mudar a
   * regra que um processo já publicado aplicou.
   */
  readonly regraDistribuicaoCodigo: string;
  readonly regraDistribuicaoVersao: string;
  /** Obrigatória na Lei 12.711 (art. 11, § único); ausente nas demais. */
  readonly regraAjusteCodigo: string | null;
  readonly regraAjusteVersao: string | null;
  /** Obrigatória na Lei 12.711 e recusada fora dela. */
  readonly referenciaReservaDemograficaId: string | null;
  readonly modalidades: readonly ModalidadeDaOferta[];
  readonly quadro: readonly QuantidadeDeVagas[];
}

/**
 * A regra de remanejamento escolhida no catálogo, por código e versão. `fallbackCodigo` e
 * `destinos[]` são derivados do `esquemaArgs` congelado da regra ao montar o comando
 * (UNI-REQ-0056); guardar mais que o par seria uma segunda fonte que poderia divergir dela.
 */
export interface CascataSelecionada {
  readonly regraCodigo: string;
  readonly regraVersao: string;
}

/**
 * Modalidade que a oferta seleciona. A gravação recebe o `id`; o `codigo` é como bônus e
 * documentos exigidos a nomeiam (`AC`, `LB_PPI`).
 */
export interface ModalidadeDaOferta {
  readonly id: string;
  readonly codigo: string;
  /**
   * A modalidade como o processo a gravou, quando veio do detalhe. É o que a consulta lê: o
   * catálogo vigente pode ter mudado depois da publicação, ou nem ter carregado.
   */
  readonly gravada?: ModalidadeGravada;
}

/** Os dados da modalidade que o snapshot do processo guarda, com a composição já decodificada. */
export interface ModalidadeGravada {
  readonly descricao: string | null;
  /** `null` quando a grafia gravada não pertence ao vocabulário conhecido. */
  readonly composicaoVagas: string | null;
  readonly composicaoOrigemCodigo: string | null;
  readonly regraRemanejamento: string | null;
  readonly remanejamentoDestino: string | null;
  readonly remanejamentoPar: string | null;
  readonly remanejamentoFallback: string | null;
}

/**
 * Quantidade que o edital fixa para uma modalidade. Na Lei 12.711, as de composição
 * `DENTRO_DO_VR` e `RESIDUAL_DO_VO` são calculadas pelo motor e informá-las é recusado; fora
 * dela, todas exigem quantidade.
 */
export interface QuantidadeDeVagas {
  readonly modalidadeId: string;
  readonly quantidade: string;
}
