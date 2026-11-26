/** O que numa condição da regra de homologação tem controle próprio, e portanto recebe a recusa. */
export type ControleDaCondicao =
  | 'tipo'
  | 'edicaoDoExame'
  | 'motivoDesfavoravelCodigo'
  | 'enquadramento';

/**
 * Onde a recusa à regra de homologação aparece. `homologacao` é a regra inteira, ou o que a tela
 * não liga a um controle; `homologacao.resultado` é o resultado apontado; `homologacao.alternativas.0`
 * é a primeira alternativa inteira e `homologacao.alternativas.0.condicoes.1.tipo` o tipo da segunda
 * condição dela.
 */
export type CampoDaHomologacaoDaFase =
  | 'homologacao'
  | 'homologacao.resultado'
  | `homologacao.alternativas.${number}`
  | `homologacao.alternativas.${number}.condicoes.${number}.${ControleDaCondicao}`;

export const PREFIXO_DA_HOMOLOGACAO = 'homologacao';

const CONTROLES: ReadonlyMap<string, ControleDaCondicao> = new Map(
  (['tipo', 'edicaoDoExame', 'motivoDesfavoravelCodigo', 'enquadramento'] as const).map(
    (controle) => [controle.toLowerCase(), controle],
  ),
);

function ehPosicao(texto: string): boolean {
  return texto !== '' && Number.isInteger(Number(texto));
}

function campoDaCondicao(alternativa: number, [posicao = '', controle = '']: string[]) {
  const doControle = CONTROLES.get(controle.toLowerCase());
  const daAlternativa = `${PREFIXO_DA_HOMOLOGACAO}.alternativas.${alternativa}` as const;
  if (!ehPosicao(posicao) || doControle === undefined) return daAlternativa;
  return `${daAlternativa}.condicoes.${Number(posicao)}.${doControle}` as const;
}

function campoDaAlternativa([
  posicao = '',
  secao = '',
  ...resto
]: string[]): CampoDaHomologacaoDaFase {
  if (!ehPosicao(posicao)) return PREFIXO_DA_HOMOLOGACAO;
  const alternativa = Number(posicao);
  if (secao.toLowerCase() !== 'condicoes') {
    return `${PREFIXO_DA_HOMOLOGACAO}.alternativas.${alternativa}`;
  }
  return campoDaCondicao(alternativa, resto);
}

/**
 * O campo da regra de homologação que a recusa aponta, a partir do caminho dentro da regra
 * (`alternativas.0.condicoes.1.tipo`). O que a tela não sabe ligar a um controle cai na regra
 * inteira, ou na alternativa, quando a recusa ao menos diz qual é.
 */
export function campoDaHomologacao([primeiro = '', ...resto]: string[]): CampoDaHomologacaoDaFase {
  const secao = primeiro.toLowerCase();
  if (secao === 'resultadoatocodigo') return 'homologacao.resultado';
  return secao === 'alternativas' ? campoDaAlternativa(resto) : PREFIXO_DA_HOMOLOGACAO;
}

/** Onde, dentro da regra, o campo está: a alternativa, a condição e o controle, nulos quando o campo não os cita. */
export interface LugarNaHomologacao {
  readonly alternativa: number | null;
  readonly condicao: number | null;
  readonly controle: ControleDaCondicao | null;
}

const SEM_LUGAR: LugarNaHomologacao = { alternativa: null, condicao: null, controle: null };

/** O lugar que o campo cita; a regra inteira e o resultado não citam nenhum. */
export function lugarNaHomologacao(campo: string): LugarNaHomologacao {
  const [, secao, alternativa, , condicao, controle] = campo.split('.');
  if (secao !== 'alternativas') return SEM_LUGAR;
  return {
    alternativa: Number(alternativa),
    condicao: condicao === undefined ? null : Number(condicao),
    controle: CONTROLES.get((controle ?? '').toLowerCase()) ?? null,
  };
}
