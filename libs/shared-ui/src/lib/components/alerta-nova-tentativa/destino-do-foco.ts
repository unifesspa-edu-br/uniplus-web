/** O que o foco procura quando o destino escolhido não o recebe: a região principal e o título. */
const ALTERNATIVAS = 'main, [role="main"], h1';

/** O título do `<dialog>` aberto: o que o foco procura nele quando o destino escolhido não o recebe. */
const TITULO_DO_DIALOG = '.uni-drawer__title, h1, h2, h3';

/** O `<dialog>` aberto por último: com ele modal, o resto da página não recebe foco. */
function dialogAberto(): HTMLElement | null {
  const abertos = document.querySelectorAll<HTMLElement>('dialog[open]');
  return abertos.item(abertos.length - 1);
}

/**
 * O elemento pode receber o foco agora: está na página, não está desabilitado, escondido nem
 * inerte, não fica dentro de um `<dialog>` fechado (o drawer fechado continua no DOM) e, havendo
 * um `<dialog>` aberto, está dentro dele.
 */
export function podeReceberFoco(elemento: HTMLElement | null | undefined): elemento is HTMLElement {
  if (!elemento?.isConnected) return false;
  if (elemento.closest('[inert], [hidden], dialog:not([open])') !== null) return false;
  if (!(dialogAberto()?.contains(elemento) ?? true)) return false;
  return !(elemento as HTMLElement & { disabled?: boolean }).disabled;
}

/**
 * O primeiro destino de foco que a pessoa alcança agora. Serve a uma leitura pedida na página e
 * no drawer: o foco vai ao campo do drawer quando ele está aberto, e ao título da página quando
 * não está.
 */
export function destinoAcessivel(
  ...candidatos: readonly (HTMLElement | null | undefined)[]
): HTMLElement | null {
  return candidatos.find(podeReceberFoco) ?? null;
}

/** Com um `<dialog>` aberto, o título dele e depois ele mesmo; senão, a região principal e o título. */
function alternativasDoFoco(): HTMLElement[] {
  const aberto = dialogAberto();
  if (aberto)
    return [aberto.querySelector<HTMLElement>(TITULO_DO_DIALOG), aberto].filter((e) => e !== null);
  return Array.from(document.querySelectorAll<HTMLElement>(ALTERNATIVAS));
}

/**
 * Leva o foco ao destino e confere se ele pegou; se não pegou, tenta as alternativas, para o foco
 * não cair no `body`: com um `<dialog>` aberto, o título dele e depois ele mesmo; sem dialog, a
 * região principal e o título da página. Devolve se algum elemento ficou com o foco.
 */
export function focarEmAlgum(destino: HTMLElement | null | undefined): boolean {
  for (const candidato of [destino, ...alternativasDoFoco()]) {
    if (!podeReceberFoco(candidato)) continue;
    if (!candidato.hasAttribute('tabindex') && candidato !== destino) candidato.tabIndex = -1;
    candidato.focus();
    if (document.activeElement === candidato) return true;
  }
  return false;
}
