import type { ProblemValidationError } from '@uniplus/shared-core/http';

const CAMPO = 'conceitosAdmitidos';

const MENSAGENS_POR_CODIGO: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.configuracao.tipo_etapa.conceitos_admitidos_obrigatorio',
    'Informe os conceitos admitidos, ainda que nenhum seja escolhido.',
  ],
  [
    'uniplus.configuracao.tipo_etapa.conceito_inexistente',
    'Há conceito escolhido que não existe mais no catálogo. Retire-o e escolha de novo.',
  ],
  [
    'uniplus.configuracao.tipo_etapa.conceito_inativo',
    'Há conceito escolhido que está desativado no catálogo. Retire-o para salvar.',
  ],
  [
    'uniplus.configuracao.tipo_etapa.conceito_duplicado',
    'Há conceito escolhido mais de uma vez. Recarregue a tela e escolha de novo.',
  ],
]);

/**
 * As recusas do campo dos conceitos admitidos, em mensagem estática pt-BR por código e reunidas
 * numa só (a API devolve uma por espécie de recusa e o campo mostra uma mensagem). As recusas dos
 * demais campos, e as de código desconhecido, seguem como vieram.
 */
export function recusasComMensagemDosConceitos(
  recusas: ReadonlyArray<ProblemValidationError>,
): ReadonlyArray<ProblemValidationError> {
  const dosConceitos = recusas.filter((recusa) => recusa.field === CAMPO);
  const demais = recusas.filter((recusa) => recusa.field !== CAMPO);
  if (dosConceitos.length === 0) return recusas;
  const mensagens = dosConceitos.map(
    (recusa) => MENSAGENS_POR_CODIGO.get(recusa.code) ?? recusa.message,
  );
  return [...demais, { ...dosConceitos[0], message: [...new Set(mensagens)].join(' ') }];
}
