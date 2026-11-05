/** Os ids que descrevem um controle, para o `aria-describedby`: nulo quando nenhum se aplica. */
export function idsDescritivos(ids: readonly (string | null)[]): string | null {
  return ids.filter((id) => id !== null).join(' ') || null;
}

export function idDaEtapa(idBase: string, codigo: string): string {
  return `${idBase}-etapa-${codigo}`;
}

export function idDoItem(idBase: string, fatoCodigo: string): string {
  return `${idBase}-item-${fatoCodigo}`;
}

export function idDoGrupo(idBase: string, codigo: string): string {
  return `${idBase}-grupo-${codigo}`;
}

export function idDoTermo(idBase: string, codigo: string): string {
  return `${idBase}-termo-${codigo}`;
}
