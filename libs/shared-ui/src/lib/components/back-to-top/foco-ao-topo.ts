/**
 * Escolhe quem recebe o foco ao voltar ao topo, para dar ao leitor de tela um
 * ponto de chegada. O contêiner precisa de `tabindex` (`main.page` já tem `-1`;
 * contratos internos via `uiBackToTopContainer` declaram o seu).
 *
 * O substituto só vale quando o contêiner é o padrão do shell, que pode não ser
 * focável (o `<html>`), e segue a mesma regra: sem `tabindex` o foco não se move
 * e o botão, ao se esconder, ficaria com ele. O contêiner registrado por uma
 * rota é sempre o próprio alvo do foco.
 */
export function alvoDoFocoAoTopo(
  conteiner: HTMLElement,
  padrao: HTMLElement | null,
  substituto: HTMLElement | null,
): HTMLElement | null {
  const candidato = conteiner === padrao ? substituto : null;
  const focavel = candidato?.hasAttribute('tabindex') ? candidato : null;
  return focavel ?? (conteiner.hasAttribute('tabindex') ? conteiner : null);
}

/** Indica se a pessoa pediu menos movimento no sistema. */
export function prefereMovimentoReduzido(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
