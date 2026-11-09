const ETAPA: Readonly<Record<string, string>> = {
  gestao_de_acessos: 'Gestão de acessos',
  protecao_de_dados: 'Proteção de dados',
};

const RESULTADO: Readonly<Record<string, string>> = {
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};

const SITUACAO_ENCERRADA: Readonly<Record<string, string>> = {
  recusada: 'recusada',
  cancelada: 'cancelada',
  expirada: 'expirou sem decisão',
};

export function etapaDaVersao(codigo: string): string {
  return ETAPA[codigo] ?? codigo;
}

export function resultadoDaDecisao(codigo: string): string {
  return RESULTADO[codigo] ?? codigo;
}

export function situacaoEncerrada(codigo: string): string {
  return SITUACAO_ENCERRADA[codigo] ?? codigo;
}

/** As etapas que a versão ainda exige, na ordem em que acontecem. */
export function etapasExigidas(exigeProtecaoDeDados: boolean): string {
  return exigeProtecaoDeDados
    ? `${etapaDaVersao('gestao_de_acessos')} e ${etapaDaVersao('protecao_de_dados').toLowerCase()}`
    : etapaDaVersao('gestao_de_acessos');
}
