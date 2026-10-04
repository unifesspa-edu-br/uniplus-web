import { FONTE_GEO_MUNICIPIO, fatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import type { FatoDoFormulario } from '../editor-de-formulario/formulario-editavel';

/** Como o candidato responderia um campo do formulário ou um pressuposto, na simulação. */
export interface FatoSimulado {
  readonly codigo: string;
  readonly nome: string;
  /** Resposta de um campo do formulário, ou fato pressuposto de outro formulário. */
  readonly origem: 'resposta' | 'pressuposto';
  readonly controle: 'booleano' | 'numero' | 'data' | 'lista' | 'municipio' | 'texto';
  readonly multiplo: boolean;
  /** O domínio, para converter cada valor escrito no tipo que a API compara. */
  readonly dominio: string;
  readonly valores: readonly string[];
}

/** O valor escrito que não se reconhece no domínio do fato: não se simula o que não foi informado. */
export const NAO_RECONHECIDO = Symbol('não reconhecido');

const SIM = new Set(['sim', 'true']);
const NAO = new Set(['não', 'nao', 'false']);
/** O inteiro na gramática do JSON, a mesma que a condição sobre fato numérico aceita. */
const INTEIRO = /^-?(0|[1-9]\d*)$/u;

/** O controle com que a simulação pergunta o fato, e os valores que ele oferece. */
export function simulado(fato: FatoDoFormulario, origem: FatoSimulado['origem']): FatoSimulado {
  const escolhivel = fatoEscolhivel(fato);
  const multiplo = fato.cardinalidade === 'MULTIVALORADO';
  // Vários sim/não ou vários números não cabem num controle de valor único: são escritos separados por ponto e vírgula.
  // O município é respondido pelo código IBGE, que se escolhe pelo nome na busca do Geo.
  const controle: FatoSimulado['controle'] =
    fato.fonteValores === FONTE_GEO_MUNICIPIO
      ? 'municipio'
      : multiplo && escolhivel?.tipoDominio !== 'CATEGORICO_ESTATICO'
      ? 'texto'
      : fato.dominio === 'BOOLEANO'
        ? 'booleano'
        : fato.dominio === 'NUMERICO'
          ? 'numero'
          : fato.dominio === 'DATA'
            ? 'data'
            : escolhivel?.tipoDominio === 'CATEGORICO_ESTATICO'
              ? 'lista'
              : 'texto';
  return {
    codigo: fato.codigo,
    nome: fato.nome,
    origem,
    controle,
    multiplo,
    dominio: fato.dominio,
    valores: escolhivel?.valores ?? [],
  };
}

/** O valor escrito no tipo do domínio, ou a marca de não reconhecido — nunca outro valor no lugar. */
export function valorNoDominio(dominio: string, texto: string): unknown {
  const normalizado = texto.toLocaleLowerCase('pt-BR');
  if (dominio === 'BOOLEANO') return SIM.has(normalizado) ? true : NAO.has(normalizado) ? false : NAO_RECONHECIDO;
  if (dominio === 'NUMERICO') return INTEIRO.test(texto) ? Number(texto) : NAO_RECONHECIDO;
  return texto;
}

/** A resposta em texto, como o controle a dá, no JSON que a API compara; `undefined` é sem resposta. */
export function respostaDoTexto(fato: FatoSimulado, texto: string): unknown {
  const valor: unknown =
    texto.trim() === ''
      ? undefined
      : fato.controle === 'booleano'
        ? texto === 'true'
        : fato.controle === 'numero'
          ? valorNoDominio('NUMERICO', texto.trim())
          : fato.multiplo
            ? texto
                .split(';')
                .map((parte) => parte.trim())
                .filter((parte) => parte !== '')
                .map((parte) => valorNoDominio(fato.dominio, parte))
            : texto.trim();
  // Só separadores, sem valor nenhum, é sem resposta — a lista vazia diria que ele respondeu.
  return Array.isArray(valor) && valor.length === 0 ? undefined : valor;
}

/** Se a resposta tem valor que o domínio do fato não reconhece. */
export function naoReconhecida(valor: unknown): boolean {
  return valor === NAO_RECONHECIDO || (Array.isArray(valor) && valor.includes(NAO_RECONHECIDO));
}

/** A dica de como escrever vários valores. Ponto e vírgula, e não vírgula, que é a separação decimal em pt-BR. */
export function dicaDosValores(fato: FatoSimulado): string {
  if (fato.dominio === 'BOOLEANO') return 'Escreva sim ou não, separados por ponto e vírgula.';
  if (fato.dominio === 'NUMERICO') return 'Escreva números inteiros, separados por ponto e vírgula.';
  return 'Separe os valores por ponto e vírgula.';
}

export function comResposta(atual: ReadonlyMap<string, unknown>, codigo: string, valor: unknown): ReadonlyMap<string, unknown> {
  const nova = new Map(atual);
  if (valor === undefined) nova.delete(codigo);
  else nova.set(codigo, valor);
  return nova;
}
