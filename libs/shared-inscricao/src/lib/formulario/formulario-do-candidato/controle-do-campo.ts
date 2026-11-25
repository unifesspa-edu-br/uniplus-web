/** Acima disto, a escolha única vira lista suspensa em vez de botões de opção. */
const MAXIMO_DE_OPCOES_EM_BOTOES = 6;

/** O controle com que o campo aparece para o candidato. */
export type ControleDoCampo =
  | 'fixa'
  | 'texto'
  | 'numero'
  | 'data'
  | 'booleano'
  | 'municipio'
  | 'endereco'
  | 'escolha'
  | 'lista'
  | 'codigo'
  | 'codigos';

const CONTROLE_PELO_TIPO: Readonly<Record<string, Exclude<ControleDoCampo, 'fixa'>>> = {
  SIM_OU_NAO: 'booleano',
  NUMERO: 'numero',
  DATA: 'data',
  MUNICIPIO: 'municipio',
  ENDERECO: 'endereco',
};

/**
 * O controle pelo tipo de renderização, fonte única do campo na tela e das regras que dependem de ele
 * ser de texto digitado, como a confirmação. A escolha sem valores conhecidos vira entrada de código; a
 * única com muitas opções, lista suspensa. Os dois dados da escolha só importam a ela.
 */
export function controleDoTipo(
  tipoDeCampo: string,
  escolha: { readonly semValoresConhecidos: boolean; readonly opcoes: number } = {
    semValoresConhecidos: false,
    opcoes: 0,
  },
): Exclude<ControleDoCampo, 'fixa'> {
  if (tipoDeCampo === 'ESCOLHA_UNICA') return controleDaEscolhaUnica(escolha);
  if (tipoDeCampo === 'ESCOLHA_MULTIPLA')
    return escolha.semValoresConhecidos ? 'codigos' : 'escolha';
  return Object.hasOwn(CONTROLE_PELO_TIPO, tipoDeCampo) ? CONTROLE_PELO_TIPO[tipoDeCampo] : 'texto';
}

function controleDaEscolhaUnica(escolha: {
  readonly semValoresConhecidos: boolean;
  readonly opcoes: number;
}): 'codigo' | 'lista' | 'escolha' {
  if (escolha.semValoresConhecidos) return 'codigo';
  return escolha.opcoes > MAXIMO_DE_OPCOES_EM_BOTOES ? 'lista' : 'escolha';
}
