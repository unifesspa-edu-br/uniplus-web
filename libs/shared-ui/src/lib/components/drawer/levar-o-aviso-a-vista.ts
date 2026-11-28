// Seletores do painel de formulário (formulario-em-gaveta.css): mudou lá, muda o teste ao lado.
const CORPO_DO_PAINEL = '.form-drawer .uni-drawer__body';
const RODAPE_DO_PAINEL = '.form-drawer__footer';
const AVISOS =
  'ui-alert[variant="danger"], ui-alert[variant="warning"], .alert--danger, .field__error';
const BLOCO_DO_AVISO = 'ui-alert, .alert, .field';

/**
 * Depois de uma recusa, rola o corpo do painel até o primeiro aviso, na ordem em que aparecem na
 * tela: o aviso do topo, o aviso do formulário ou a mensagem de um campo. O corpo é quem rola, e o
 * rodapé de ações fica preso no fundo; sem isto, em tela estreita, o aviso fica acima da janela e
 * quem enxerga não percebe a recusa. O campo com foco continua visível: se a rolagem o escondeu,
 * ele volta à vista e o aviso fica alcançável por rolagem.
 *
 * A raiz pode conter o painel ou estar dentro dele. Fora de um painel de formulário não faz nada.
 */
export function levarOPrimeiroAvisoAVista(raiz: HTMLElement): void {
  const corpo =
    raiz.querySelector<HTMLElement>(CORPO_DO_PAINEL) ?? raiz.closest<HTMLElement>(CORPO_DO_PAINEL);
  const aviso = corpo === null ? null : primeiroAvisoVisivel(corpo);
  if (corpo === null || aviso === null) return;

  const bloco = aviso.closest<HTMLElement>(BLOCO_DO_AVISO) ?? aviso;
  bloco.scrollIntoView?.({ block: 'start', inline: 'nearest' });
  manterOFocoVisivel(corpo);
}

function primeiroAvisoVisivel(corpo: HTMLElement): HTMLElement | null {
  const avisos = corpo.querySelectorAll<HTMLElement>(AVISOS);
  return [...avisos].find((aviso) => aviso.closest('[hidden]') === null) ?? null;
}

function manterOFocoVisivel(corpo: HTMLElement): void {
  const focado = document.activeElement;
  if (!(focado instanceof HTMLElement) || !corpo.contains(focado)) return;
  if (focado.closest(RODAPE_DO_PAINEL) !== null) return;

  const area = corpo.getBoundingClientRect();
  const rodape = corpo.querySelector(RODAPE_DO_PAINEL)?.getBoundingClientRect();
  const caixa = focado.getBoundingClientRect();
  const fimDaArea = rodape === undefined ? area.bottom : rodape.top;
  if (caixa.top < area.top) {
    corpo.scrollTop -= area.top - caixa.top;
  } else if (caixa.bottom > fimDaArea) {
    corpo.scrollTop += caixa.bottom - fimDaArea;
  }
}
