import { respostaExigida } from '@uniplus/shared-data/utils';
import { DefinirTaxaInscricaoRequest, FundamentoIsencaoCodigo } from '@uniplus/shared-data/selecao';

import { ValidacaoDoPasso, WizardDraft } from '../../processo-seletivo.models';
import { analisarValorEmReais, FORMATO_VALOR_EM_REAIS } from '../../shared/valor-em-reais';

type DeclaracaoDaTaxa = WizardDraft['pagamento'];

export function fundamentoSemSelecao(pagamento: DeclaracaoDaTaxa): boolean {
  return pagamento.cobra === true && pagamento.fundamentos.length === 0;
}

function mensagemDoValorDaTaxa(valorEscrito: string): string | null {
  const valor = analisarValorEmReais(valorEscrito);
  if (valor === null) return `Informe o valor da taxa. ${FORMATO_VALOR_EM_REAIS}`;
  return valor <= 0 ? 'O valor da taxa precisa ser maior que zero.' : null;
}

/**
 * Quem cobra reconhece ao menos um fundamento: é por eles que o candidato poderá
 * pedir isenção, e o servidor recusa a gravação sem nenhum.
 */
export function validarDeclaracaoDaTaxa(pagamento: DeclaracaoDaTaxa): ValidacaoDoPasso {
  const mensagens: (string | null)[] = [
    pagamento.cobra === null ? 'Declare se o processo cobra taxa de inscrição.' : null,
    pagamento.cobra === true ? mensagemDoValorDaTaxa(pagamento.valor) : null,
    fundamentoSemSelecao(pagamento) ? 'Selecione ao menos um fundamento de isenção.' : null,
  ];
  const recusas = mensagens.filter((mensagem): mensagem is string => mensagem !== null);
  return recusas.length > 0 ? { valid: false, messages: recusas } : { valid: true };
}

export function alternarFundamentoEscolhido(
  escolhidos: readonly FundamentoIsencaoCodigo[],
  codigo: FundamentoIsencaoCodigo,
): FundamentoIsencaoCodigo[] {
  return escolhidos.includes(codigo)
    ? escolhidos.filter((item) => item !== codigo)
    : [...escolhidos, codigo];
}

export function comandoDaTaxa(pagamento: DeclaracaoDaTaxa): DefinirTaxaInscricaoRequest {
  return {
    cobra: respostaExigida(pagamento.cobra, 'se o processo cobra taxa de inscrição'),
    valor: analisarValorEmReais(pagamento.valor),
    fundamentos: pagamento.fundamentos,
  };
}
