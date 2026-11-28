import type { ConfirmacaoDeGravacao, ItemDeConfirmacao } from '../../passo-do-wizard';

export interface EntradaDaConfirmacao {
  readonly numeroDeOpcoes: string;
  readonly ofertas: number;
  readonly vagasInformadas: number;
  /** `null` quando o quadro gravado ainda não foi simulado: o cálculo da regra não é conhecido. */
  readonly totalPublicado: number | null;
  readonly totaisPorModalidade: readonly ItemDeConfirmacao[];
  readonly regraDeDistribuicao: string;
  readonly regraDeRemanejamento: string | null;
}

const CABECALHO_DA_CONFIRMACAO = {
  titulo: 'Confirmar o quadro de vagas',
  aviso:
    'Este é o quadro de vagas que o edital publica. Boa parte dele vem do cálculo da regra — confira os totais antes de gravar.',
  rotuloDeConfirmar: 'Gravar quadro de vagas',
} as const;

/**
 * O resumo que a página confirma antes de gravar o quadro. É montado do estado no instante em que
 * se grava, então não há marca guardada que envelheça entre o clique e a gravação.
 */
export function confirmacaoDasVagas(entrada: EntradaDaConfirmacao): ConfirmacaoDeGravacao {
  return { ...CABECALHO_DA_CONFIRMACAO, itens: itensDaConfirmacao(entrada) };
}

function itensDaConfirmacao(entrada: EntradaDaConfirmacao): readonly ItemDeConfirmacao[] {
  return [
    { rotulo: 'Número de opções de curso', valor: entrada.numeroDeOpcoes },
    { rotulo: 'Ofertas de curso no quadro', valor: String(entrada.ofertas) },
    { rotulo: 'Vagas informadas nas ofertas', valor: String(entrada.vagasInformadas) },
    ...itemDoTotalPublicado(entrada),
    ...entrada.totaisPorModalidade,
    { rotulo: 'Regra de distribuição', valor: entrada.regraDeDistribuicao },
    ...itemDaRegraDeRemanejamento(entrada),
  ];
}

/**
 * Sob a Lei 12.711 a suplementar acresce ao total da oferta, então o que o edital publica pode
 * ser maior que a soma das vagas informadas. O total publicado só entra quando difere: repetir o
 * mesmo número em duas linhas faria o operador procurar uma diferença que não existe.
 */
function itemDoTotalPublicado(entrada: EntradaDaConfirmacao): readonly ItemDeConfirmacao[] {
  if (entrada.totalPublicado === null || entrada.totalPublicado === entrada.vagasInformadas) {
    return [];
  }
  return [
    {
      rotulo: 'Total publicado (com a suplementar da regra)',
      valor: String(entrada.totalPublicado),
    },
  ];
}

function itemDaRegraDeRemanejamento(entrada: EntradaDaConfirmacao): readonly ItemDeConfirmacao[] {
  if (entrada.regraDeRemanejamento === null) return [];
  return [{ rotulo: 'Regra de remanejamento', valor: entrada.regraDeRemanejamento }];
}
