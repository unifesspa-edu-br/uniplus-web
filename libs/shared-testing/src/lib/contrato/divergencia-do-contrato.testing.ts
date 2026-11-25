export interface DivergenciaDoContrato {
  readonly metodo: string;
  readonly caminho: string;
  readonly campo: string;
  readonly regra: string;
}

export function mensagemDasDivergencias(divergencias: readonly DivergenciaDoContrato[]): string {
  return divergencias
    .map(({ metodo, caminho, campo, regra }) => `${metodo} ${caminho}: ${campo} — ${regra}`)
    .join('\n');
}
