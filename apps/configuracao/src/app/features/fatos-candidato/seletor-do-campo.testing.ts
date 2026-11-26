/** Os campos de proteção não têm `formControlName`: o componente recebe cada controle e os identifica pelo id. */
const FIM_DO_ID_DA_PROTECAO: Readonly<Record<string, string>> = {
  classificacaoProtecao: 'classificacaoProtecao',
  hipoteseLegal: 'hipoteses',
  finalidadeTratamento: 'finalidadeTratamento',
};

/** O seletor do campo do formulário, pelo `formControlName` ou, na proteção, pelo id. */
export function seletorDoCampo(nome: string, dentroDe = ''): string {
  const fim = FIM_DO_ID_DA_PROTECAO[nome];
  const seletor = fim ? `[id$="-${fim}"]` : `[formcontrolname="${nome}"]`;
  return `${dentroDe}${dentroDe ? ' ' : ''}${seletor}`;
}
