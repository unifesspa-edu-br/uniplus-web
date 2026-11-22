import type { BancaDeclarada } from '../../modelos/banca.models';
import { CAMPOS_DA_BANCA } from '../deliberacao/recusas-da-regra';
import type { LocalDaRecusa } from '../recusas/local-da-recusa';

export type ListaDeBancas = 'bancasRequeridas' | 'bancas';

/** Converte a posição devolvida pela API na identidade da banca enviada. */
export function campoDaBancaEnviada(
  caminho: string,
  lista: ListaDeBancas,
  bancas: readonly BancaDeclarada[],
): string | null {
  const partes = partesDaBanca(caminho, lista);
  if (partes === null) return null;
  const banca = bancas[Number(partes[2])];
  return campoComIdentificador(lista, banca?.identificadorLocal, partes[3]);
}

/** Converte o identificador persistido na identidade da banca presente na tela. */
export function campoDaBancaIdentificada(
  caminho: string,
  lista: ListaDeBancas,
  bancas: readonly BancaDeclarada[],
  id: string | null,
): string | null {
  const partes = partesDaBanca(caminho, lista);
  if (partes === null) return null;
  const banca = id === null ? undefined : bancas.find((item) => item.id === id);
  return campoComIdentificador(lista, banca?.identificadorLocal, partes[3]);
}

function partesDaBanca(caminho: string, lista: ListaDeBancas): RegExpExecArray | null {
  return new RegExp(`^(${lista})\\.(\\d+)(?:\\.(.+))?$`, 'i').exec(caminho);
}

function campoComIdentificador(lista: ListaDeBancas, id: string | undefined, campo = ''): string {
  if (id === undefined) return lista;
  return [lista, id, campo].filter(Boolean).join('.');
}

/** O local da recusa já com a banca da tela, e se a banca que ela apontava saiu da tela. */
export interface LocalComABanca {
  readonly local: LocalDaRecusa;
  readonly bancaAusente: boolean;
}

/** O local da recusa da gravação com a banca da posição enviada trocada pela banca da tela. */
export function localDaBancaEnviada(
  local: LocalDaRecusa,
  lista: ListaDeBancas,
  bancas: readonly BancaDeclarada[],
): LocalComABanca {
  const campo = local.caminho === null ? null : campoDaBancaEnviada(local.caminho, lista, bancas);
  return comOCampoDaBanca(local, lista, campo);
}

/** O local da recusa da publicação com a banca achada pelo identificador que a API deu. */
export function localDaBancaIdentificada(
  local: LocalDaRecusa,
  lista: ListaDeBancas,
  bancas: readonly BancaDeclarada[],
  id: string | null,
): LocalComABanca {
  const campo =
    local.caminho === null ? null : campoDaBancaIdentificada(local.caminho, lista, bancas, id);
  return comOCampoDaBanca(local, lista, campo);
}

function comOCampoDaBanca(
  local: LocalDaRecusa,
  lista: ListaDeBancas,
  campo: string | null,
): LocalComABanca {
  if (campo === null) return { local, bancaAusente: false };
  return { local: { ...local, caminho: campo }, bancaAusente: campo === lista };
}

/** A banca que o campo da recusa nomeia na tela, e o controle dela que a recusa aponta. */
export interface BancaDoCampo {
  readonly identificador: string;
  readonly controle: string | null;
}

/** Lê o campo `<lista>.<identificadorLocal>[.<controle>]`; `null` quando o campo não é de uma banca. */
export function bancaDoCampo(campo: string, lista: ListaDeBancas): BancaDoCampo | null {
  const partes = new RegExp(`^${lista}\\.([^.]+)(?:\\.([^.]+))?$`).exec(campo);
  return partes === null ? null : { identificador: partes[1], controle: partes[2] ?? null };
}

/**
 * O campo da recusa sob o identificador da banca: o controle da regra de deliberação ou a lista de
 * categorias quando a recusa os aponta, e a banca inteira nos demais casos. Sem identificador, ou
 * com a posição que a tela não pôde converter, é a seção.
 */
export function campoDaBancaReconhecida<L extends ListaDeBancas>(
  lista: L,
  [identificador, ...resto]: string[],
): L | `${L}.${string}` {
  if (identificador === undefined || /^\d+$/.test(identificador)) return lista;
  const controle = controleDaBanca(resto);
  return controle === null ? `${lista}.${identificador}` : `${lista}.${identificador}.${controle}`;
}

function controleDaBanca([primeiro = '', segundo = '']: string[]): string | null {
  if (primeiro.toLowerCase() === 'categoriasdocumentoids') return 'categoriasDocumentoIds';
  if (primeiro.toLowerCase() !== 'regradedeliberacao') return null;
  return CAMPOS_DA_BANCA.find((campo) => campo.toLowerCase() === segundo.toLowerCase()) ?? 'regra';
}
