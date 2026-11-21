import { ConteudoDoFormulario, ItemDoFormulario, OpcoesCondicionadas } from './tipos';

/**
 * A recusa que aponta uma restrição do campo. A API aponta pela posição na lista enviada
 * (`restricoes[0].entradas[1].quando`), que muda quando o administrador remove uma restrição ou um
 * grupo depois da recusa; por isso ela é guardada pelo que não muda: o tipo da restrição — um por
 * campo — e o conteúdo do grupo de opções enviado. Nulo no grupo quando aponta a restrição inteira.
 */
export interface RecusaDaRestricao {
  readonly tipo: string;
  readonly grupo: string | null;
  readonly mensagem: string;
}

/** As recusas da API distribuídas pelo que a tela mostra: o item, a restrição dele, a etapa, ou o resumo. */
export interface RecusasDoConteudo {
  readonly porItem: ReadonlyMap<string, readonly string[]>;
  /** As que apontam uma restrição, pelo fato do campo — do item ou do campo de grupo. */
  readonly porRestricao: ReadonlyMap<string, readonly RecusaDaRestricao[]>;
  readonly porEtapa: ReadonlyMap<string, readonly string[]>;
  readonly porTermo: ReadonlyMap<string, readonly string[]>;
  readonly porGrupo: ReadonlyMap<string, readonly string[]>;
  readonly gerais: readonly string[];
}

/**
 * Distribui as recusas pelo índice que a API aponta na lista enviada (`conteudo.itens[3].rotulo`).
 * A recusa sem índice — a do grafo, que cita o fato só na mensagem — vai para o resumo.
 */
export function distribuirRecusas(
  recusas: readonly { readonly field: string; readonly message: string }[],
  enviado: ConteudoDoFormulario,
): RecusasDoConteudo {
  const distribuicao = new DistribuicaoDasRecusas();
  for (const recusa of recusas) {
    distribuicao.receber(destinoDaRecusa(recusa.field, enviado), recusa);
  }
  return distribuicao.recusas();
}

type DestinoDaRecusa =
  | { readonly tipo: 'campo'; readonly campo: ItemDoFormulario }
  | { readonly tipo: 'grupo' | 'etapa' | 'termo'; readonly codigo: string }
  | { readonly tipo: 'geral' };

/** Onde a tela mostra a recusa, pelo índice que a API apontou na lista enviada. */
function destinoDaRecusa(campo: string, enviado: ConteudoDoFormulario): DestinoDaRecusa {
  const noGrupo = destinoNoGrupo(campo, enviado);
  if (noGrupo !== undefined) return noGrupo;
  const item = elementoApontado(campo, 'itens', enviado.itens ?? []);
  if (item !== undefined) return { tipo: 'campo', campo: item };
  const etapa = elementoApontado(campo, 'etapas', enviado.etapas ?? []);
  if (etapa !== undefined) return { tipo: 'etapa', codigo: etapa.codigo };
  const termo = elementoApontado(campo, 'termos', enviado.termos ?? []);
  return termo === undefined ? { tipo: 'geral' } : { tipo: 'termo', codigo: termo.codigo };
}

function destinoNoGrupo(campo: string, enviado: ConteudoDoFormulario): DestinoDaRecusa | undefined {
  const grupo = elementoApontado(campo, 'grupos', enviado.grupos ?? []);
  if (grupo === undefined) return undefined;
  // O campo do grupo tem código único no formulário: a recusa dele vai ao campo, como a de um item.
  const campoDoGrupo = elementoApontado(campo, 'subitens', grupo.subitens);
  return campoDoGrupo === undefined
    ? { tipo: 'grupo', codigo: grupo.codigo }
    : { tipo: 'campo', campo: campoDoGrupo };
}

interface Recusa {
  readonly field: string;
  readonly message: string;
}

class DistribuicaoDasRecusas {
  private readonly porItem = new Map<string, string[]>();
  private readonly porRestricao = new Map<string, RecusaDaRestricao[]>();
  private readonly porEtapa = new Map<string, string[]>();
  private readonly porTermo = new Map<string, string[]>();
  private readonly porGrupo = new Map<string, string[]>();
  private readonly gerais: string[] = [];

  receber(destino: DestinoDaRecusa, recusa: Recusa): void {
    if (destino.tipo === 'campo') this.acumularNoCampo(destino.campo, recusa);
    else if (destino.tipo === 'geral') this.gerais.push(recusa.message);
    else if (destino.tipo === 'grupo') acumular(this.porGrupo, destino.codigo, recusa.message);
    else if (destino.tipo === 'etapa') acumular(this.porEtapa, destino.codigo, recusa.message);
    else acumular(this.porTermo, destino.codigo, recusa.message);
  }

  recusas(): RecusasDoConteudo {
    const { porItem, porRestricao, porEtapa, porTermo, porGrupo, gerais } = this;
    return { porItem, porRestricao, porEtapa, porTermo, porGrupo, gerais };
  }

  /**
   * A recusa do campo vai à restrição que ela aponta — e ao grupo de opções, quando aponta um —, ou
   * ao campo quando não aponta restrição que o envio tenha.
   */
  private acumularNoCampo(enviado: ItemDoFormulario, recusa: Recusa): void {
    const apontada = restricaoApontada(enviado, recusa.field);
    if (apontada === undefined) {
      acumular(this.porItem, enviado.fatoCodigo, recusa.message);
      return;
    }
    acumular(
      this.porRestricao,
      enviado.fatoCodigo,
      recusaDaRestricaoApontada(apontada, recusa.message),
    );
  }
}

type RestricaoDoItem = NonNullable<ItemDoFormulario['regras']['restricoes']>[number];

interface RestricaoApontada {
  readonly restricao: RestricaoDoItem;
  readonly grupo: OpcoesCondicionadas | undefined;
}

function restricaoApontada(
  enviado: ItemDoFormulario,
  field: string,
): RestricaoApontada | undefined {
  const apontada = /\.restricoes\[(\d+)\](?:\.entradas\[(\d+)\])?/iu.exec(field);
  if (apontada === null) return undefined;
  const restricao = (enviado.regras.restricoes ?? [])[Number(apontada[1])];
  if (restricao === undefined) return undefined;
  const grupo =
    apontada[2] === undefined ? undefined : (restricao.entradas ?? [])[Number(apontada[2])];
  return { restricao, grupo };
}

function recusaDaRestricaoApontada(
  { restricao, grupo }: RestricaoApontada,
  mensagem: string,
): RecusaDaRestricao {
  return {
    tipo: restricao.tipo,
    grupo: grupo === undefined ? null : chaveDoGrupoDeOpcoes(grupo),
    mensagem,
  };
}

/** O conteúdo do grupo de opções como chave: a condição como veio e os valores sem depender da ordem. */
function chaveDoGrupoDeOpcoes(grupo: OpcoesCondicionadas): string {
  return JSON.stringify({ quando: grupo.quando ?? null, valores: [...grupo.valores].sort() });
}

/** As recusas que apontam a restrição do tipo dado inteira, e não um grupo dela. */
export function recusasDaRestricao(
  recusas: readonly RecusaDaRestricao[],
  tipo: string,
): readonly string[] {
  return recusas
    .filter((recusa) => recusa.tipo === tipo && recusa.grupo === null)
    .map((recusa) => recusa.mensagem);
}

/**
 * As recusas do grupo de opções atual: as que apontaram, no envio, um grupo de mesmo conteúdo. O
 * grupo removido ou editado depois da recusa não tem mais a quem mostrá-la, e ela não migra para o
 * grupo que passou a ocupar a posição dele. Só as opções permitidas têm grupos.
 */
export function recusasDoGrupoDeOpcoes(
  recusas: readonly RecusaDaRestricao[],
  grupo: OpcoesCondicionadas,
): readonly string[] {
  const chave = chaveDoGrupoDeOpcoes(grupo);
  return recusas.filter((recusa) => recusa.grupo === chave).map((recusa) => recusa.mensagem);
}

function elementoApontado<T>(campo: string, lista: string, elementos: readonly T[]): T | undefined {
  const encontrado = new RegExp(`(?:^|\\.)${lista}\\[(\\d+)\\]`, 'iu').exec(campo);
  return encontrado === null ? undefined : elementos[Number(encontrado[1])];
}

function acumular<T>(mapa: Map<string, T[]>, chave: string, recusa: T): void {
  mapa.set(chave, [...(mapa.get(chave) ?? []), recusa]);
}
