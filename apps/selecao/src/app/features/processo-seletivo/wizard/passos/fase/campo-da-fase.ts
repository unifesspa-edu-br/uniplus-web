import type { ExigenciasDaFase } from '../../shared/descricao-da-fase';
import {
  controleDoRecurso,
  type ControleDoRecurso,
} from '../../shared/recusas/controle-do-recurso';
import { campoDaBancaNoCaminho } from '../../shared/deliberacao/recusas-da-regra';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';
import type { CampoDaFase } from './configuracao-da-fase';

/** O campo das recusas que a fase recebe mas a tela não mostra num controle: ficam no topo da fase. */
export const NO_TOPO_DA_FASE = '';

/** Um controle da regra de recurso da fase, que a recusa do servidor aponta campo a campo. */
export type CampoDoRecursoDaFase = `recurso.${ControleDoRecurso}`;

/** Um campo de uma linha da lista de publicações, na chave `produtos.1.atoCodigo`; `produtos.1` é a linha inteira. */
export type CampoDaPublicacaoDaFase =
  | `produtos.${number}.${'atoCodigo' | 'papel'}`
  | `produtos.${number}`;

/**
 * Onde a recusa do servidor aparece: os campos que a conferência local já nomeia, mais os que só o
 * servidor recusa. `produtos` é a lista de publicações inteira e `produtos.1.papel` o papel da
 * segunda linha dela. `bancasRequeridas` reúne as recusas às bancas que não são de um campo da
 * regra de deliberação, e `bancasRequeridas.0.quorum` é o quórum da primeira banca. `recurso` é a
 * regra de recurso inteira, para a recusa que não aponta um
 * controle dela, e `NO_TOPO_DA_FASE` é a fase inteira ou um campo dela que a tela mostra sem
 * controle de recusa.
 */
export type CampoDaRecusaDaFase =
  | typeof NO_TOPO_DA_FASE
  | CampoDaFase
  | CampoDaPublicacaoDaFase
  | CampoDoRecursoDaFase
  | 'inicio'
  | 'fim'
  | 'unidadeResponsavelId'
  | 'recurso';

const CAMPOS_DA_FASE: ReadonlyMap<string, CampoDaRecusaDaFase> = new Map(
  (['inicio', 'fim', 'unidadeResponsavelId', 'emiteParecerIndividual'] as const).map((campo) => [
    campo.toLowerCase(),
    campo,
  ]),
);

/**
 * Os campos da própria fase que a tela mostra mas não liga a um controle de recusa: a recusa a
 * eles fica no topo da fase. O que não está aqui nem entre os campos com controle não é campo da
 * fase, e a recusa vai ao resumo do passo.
 */
const CAMPOS_NO_TOPO_DA_FASE: ReadonlySet<string> = new Set(
  ['ordem', 'faseCanonicaId', 'noMesmoMomentoDaAnterior', 'tiposDeDecisao'].map((campo) =>
    campo.toLowerCase(),
  ),
);

/** Os campos de cada linha da lista de publicações que têm controle, pelo nome em minúsculas. */
const CAMPOS_DA_PUBLICACAO: ReadonlyMap<string, 'atoCodigo' | 'papel'> = new Map([
  ['atocodigo', 'atoCodigo'],
  ['papel', 'papel'],
]);

/** As listas da fase cujas linhas a recusa aponta pela posição. */
export type ListaDaFase = 'produtos' | 'bancasRequeridas';

const LINHA_DA_LISTA: Readonly<Record<ListaDaFase, RegExp>> = {
  produtos: /^produtos\.(\d+)(?:\.|$)/,
  bancasRequeridas: /^bancasRequeridas\.(\d+)(?:\.|$)/,
};

/** O que a regra de recurso tem sem controle de recusa: a recusa fica na regra inteira. */
const CAMPOS_DA_REGRA_SEM_CONTROLE: ReadonlySet<string> = new Set(['procedimentosderecurso']);

/**
 * O campo da fase sob o qual a recusa do servidor aparece. `NO_TOPO_DA_FASE` é a fase inteira ou
 * um campo dela que a tela mostra sem controle de recusa; `null` é o caminho que a fase não
 * conhece, ou que não se lê, e a recusa vai ao resumo do passo.
 */
export function campoDaRecusaDaFase(local: LocalDaRecusa): CampoDaRecusaDaFase | null {
  if (local.dono !== 'fase' || local.caminho === null) return null;
  const [primeiro, ...resto] = local.caminho.split('.');
  const chave = primeiro.toLowerCase();
  if (chave === 'regrarecurso') return campoDoRecurso(resto[0] ?? '');
  if (chave === 'produtos') return campoDaPublicacao(resto);
  if (chave === 'bancasrequeridas') return campoDaBancaRequerida(resto);
  if (chave === '' || CAMPOS_NO_TOPO_DA_FASE.has(chave)) return NO_TOPO_DA_FASE;
  return CAMPOS_DA_FASE.get(chave) ?? null;
}

/**
 * O campo de uma linha da lista de publicações. A linha sem controle para o que foi recusado fica
 * na linha inteira, e a recusa que não diz a posição fica na lista.
 */
function campoDaPublicacao([posicao = '', subcampo = '']: string[]): CampoDaRecusaDaFase {
  if (!/^\d+$/.test(posicao)) return 'produtos';
  const campo = CAMPOS_DA_PUBLICACAO.get(subcampo.toLowerCase());
  const linha = Number(posicao);
  return campo === undefined ? `produtos.${linha}` : `produtos.${linha}.${campo}`;
}

/**
 * O campo da regra de deliberação de uma banca requerida. A banca inteira e o tipo dela, e a
 * recusa que não diz a posição, ficam na lista de bancas.
 */
function campoDaBancaRequerida([posicao = '', ...dentroDaBanca]: string[]): CampoDaRecusaDaFase {
  const campo = campoDaBancaNoCaminho(dentroDaBanca);
  if (!/^\d+$/.test(posicao) || campo === null) return 'bancasRequeridas';
  return `bancasRequeridas.${Number(posicao)}.${campo}`;
}

/** A posição da linha da lista a que o campo se refere; `null` quando ele não é de uma linha dela. */
export function posicaoNaLista(campo: string, lista: ListaDaFase): number | null {
  const linha = LINHA_DA_LISTA[lista].exec(campo);
  return linha === null ? null : Number(linha[1]);
}

/** Quantas linhas tem cada lista da fase. */
export type LinhasDasListasDaFase = Readonly<Record<ListaDaFase, number>>;

/**
 * A recusa a uma linha só aponta a linha enquanto a posição existe na lista; sem ela, a recusa
 * fica na lista inteira.
 */
export function campoComLinhaNaLista(
  campo: CampoDaRecusaDaFase,
  linhas: LinhasDasListasDaFase,
): CampoDaRecusaDaFase {
  const listas = Object.keys(linhas) as ListaDaFase[];
  const semLinha = listas.find((lista) => {
    const posicao = posicaoNaLista(campo, lista);
    return posicao !== null && posicao >= linhas[lista];
  });
  return semLinha ?? campo;
}

/** O campo da regra de recurso; o campo que ela não tem é `null`. */
function campoDoRecurso(campo: string): CampoDaRecusaDaFase | null {
  const controle = controleDoRecurso(campo);
  if (controle !== null) return `recurso.${controle}`;
  const daRegraInteira = campo === '' || CAMPOS_DA_REGRA_SEM_CONTROLE.has(campo.toLowerCase());
  return daRegraInteira ? 'recurso' : null;
}

/**
 * O Fim da fase está à vista: o período é obrigatório, a publicação exige o Fim, ou há Fim ou
 * recusa a ele. O Fim que existe nunca fica escondido, nem na fase que a tela não sabe descrever.
 */
export function fimDaFaseNaTela(
  exigencias: ExigenciasDaFase | null,
  haFimOuRecusa: boolean,
): boolean {
  return (
    haFimOuRecusa || exigencias?.janelaObrigatoria === true || exigencias?.fimObrigatorio === true
  );
}

/**
 * O campo da linha do tempo da fase tem controle na tela. A fase que a tela não sabe descrever não
 * mostra a unidade nem o início: só existem quando se sabe o que a fase exige. O início aparece só
 * com o período obrigatório. O Fim tem sempre onde receber a recusa, porque `fimDaFaseNaTela` o
 * mostra quando há recusa a ele, mesmo sem saber o que a fase exige. Os demais campos da fase têm
 * controle sempre que a fase está aberta.
 */
export function campoNaTela(campo: string, exigencias: ExigenciasDaFase | null): boolean {
  if (campo === 'unidadeResponsavelId') return exigencias !== null;
  if (campo === 'inicio') return exigencias?.janelaObrigatoria === true;
  return true;
}
