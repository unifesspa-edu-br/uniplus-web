/**
 * O que o leitor de tela recebe da nova tentativa: o texto das regiões `role="status"`
 * (`ui-situacao-da-nova-tentativa`) dentro de `raiz` que têm conteúdo e estão expostas. O drawer
 * fechado continua no DOM, mas o que está nele não é lido.
 */
export function situacoesDaNovaTentativa(raiz: ParentNode): string[] {
  return Array.from(raiz.querySelectorAll('ui-situacao-da-nova-tentativa[role="status"]'))
    .filter((regiao) => regiao.closest('dialog:not([open])') === null)
    .map((regiao) => regiao.textContent?.trim() ?? '')
    .filter((texto) => texto !== '');
}

/** O texto único da nova tentativa em `raiz`; falha o teste se houver duas regiões com texto. */
export function situacaoDaNovaTentativa(raiz: ParentNode): string {
  const textos = situacoesDaNovaTentativa(raiz);
  if (textos.length > 1) {
    throw new Error(
      `Havia ${textos.length} avisos de nova tentativa ao mesmo tempo: ${textos.join(' | ')}`,
    );
  }
  return textos[0] ?? '';
}

export const TEXTO_TENTANDO = 'Tentando novamente…';
export const TEXTO_REPETIDA = 'A nova tentativa também falhou.';

export function textoTentandoDe(assunto: string): string {
  return `Recarregando ${assunto}…`;
}

export function textoRepetidaDe(assunto: string): string {
  return `A nova tentativa de recarregar ${assunto} também falhou.`;
}

/** O texto da nova tentativa do alerta `ui-alerta-nova-tentativa` que tem `titulo`, em `raiz`. */
export function situacaoDoAlerta(raiz: ParentNode, titulo: string): string {
  const alerta = Array.from(raiz.querySelectorAll('ui-alerta-nova-tentativa')).find((a) =>
    a.textContent?.includes(titulo),
  );
  if (!alerta) throw new Error(`Não havia alerta de nova tentativa com o título "${titulo}"`);
  return situacaoDaNovaTentativa(alerta);
}

/** O texto da nova tentativa do alerta a que pertence o botão "Tentar novamente". */
export function situacaoDoBotao(botao: Element): string {
  const alerta = botao.closest('ui-alerta-nova-tentativa');
  if (!alerta) throw new Error('O botão não está num alerta de nova tentativa');
  return situacaoDaNovaTentativa(alerta);
}
