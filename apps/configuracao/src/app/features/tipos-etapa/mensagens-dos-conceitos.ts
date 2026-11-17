import type { RecusaDoServidor } from '../../shared/formulario';

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
 * As recusas do campo dos conceitos admitidos, em mensagem estática pt-BR por código; cada
 * recusa segue com o seu código e a sua página. As recusas dos demais campos, e as de código
 * desconhecido, seguem como vieram.
 */
export function recusasComMensagemDosConceitos(
  recusas: readonly RecusaDoServidor[],
): readonly RecusaDoServidor[] {
  return recusas.map((recusa) =>
    recusa.campo === CAMPO
      ? { ...recusa, mensagem: MENSAGENS_POR_CODIGO.get(recusa.codigo) ?? recusa.mensagem }
      : recusa,
  );
}
