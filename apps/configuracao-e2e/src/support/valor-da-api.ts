const ROTULOS: Readonly<Record<string, string>> = {
  PUBLICO: 'Público',
  INTERNO: 'Interno',
  PESSOAL: 'Pessoal',
  SENSIVEL: 'Pessoal sensível',
  EXECUCAO_POLITICAS_PUBLICAS: 'Execução de políticas públicas',
  CANDIDATO: 'Candidato',
  MEMBRO: 'Membro do grupo familiar',
  MOEDA: 'Valor em reais',
  DECLARADO: 'Declarado',
  CALCULADO: 'Calculado',
  INTEGRACAO: 'Integração',
  VALOR_UNICO: 'Um valor',
  SIM_OU_NAO: 'Sim ou não',
  NUMERICO: 'Número',
};

/** Um valor como a API o devolve: o código e o rótulo que a tela mostra. */
export function valorDaApi(codigo: string, rotulo: string = ROTULOS[codigo] ?? codigo) {
  return { codigo, rotulo };
}
