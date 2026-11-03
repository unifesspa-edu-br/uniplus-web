import type { ConfirmacaoDeGravacao, ItemDeConfirmacao } from '../../passo-do-wizard';

export interface EntradaDaConfirmacao {
  readonly numeroDeOpcoes: string;
  readonly ofertas: number;
  readonly vagasInformadas: number;
  readonly totalPublicado: number;
  readonly totaisPorModalidade: readonly ItemDeConfirmacao[];
  readonly regraDeDistribuicao: string;
  readonly regraDeRemanejamento: string | null;
}

/**
 * O resumo que a página confirma antes de gravar o quadro. É montado do estado no instante em que
 * se grava, então não há marca guardada que envelheça entre o clique e a gravação.
 */
export function confirmacaoDasVagas(entrada: EntradaDaConfirmacao): ConfirmacaoDeGravacao {
  return {
    titulo: 'Confirmar o quadro de vagas',
    aviso:
      'Este é o quadro de vagas que o edital publica. Boa parte dele vem do cálculo da regra — confira os totais antes de gravar.',
    rotuloDeConfirmar: 'Gravar quadro de vagas',
    itens: [
      { rotulo: 'Número de opções de curso', valor: entrada.numeroDeOpcoes },
      { rotulo: 'Ofertas de curso no quadro', valor: String(entrada.ofertas) },
      // Sob a Lei 12.711 a suplementar acresce ao total da oferta, então o que o edital publica
      // pode ser maior que a soma das vagas informadas. O total publicado só entra quando difere:
      // repetir o mesmo número em duas linhas faria o operador procurar uma diferença que não existe.
      { rotulo: 'Vagas informadas nas ofertas', valor: String(entrada.vagasInformadas) },
      ...(entrada.totalPublicado === entrada.vagasInformadas
        ? []
        : [
            {
              rotulo: 'Total publicado (com a suplementar da regra)',
              valor: String(entrada.totalPublicado),
            },
          ]),
      ...entrada.totaisPorModalidade,
      { rotulo: 'Regra de distribuição', valor: entrada.regraDeDistribuicao },
      ...(entrada.regraDeRemanejamento === null
        ? []
        : [{ rotulo: 'Regra de remanejamento', valor: entrada.regraDeRemanejamento }]),
    ],
  };
}
