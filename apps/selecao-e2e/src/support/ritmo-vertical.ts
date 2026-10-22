import type { Page } from '@playwright/test';

/**
 * Pares de blocos visíveis do passo mais próximos que o ritmo vertical pede:
 * - título de seção a menos de 20 px do bloco anterior;
 * - alerta ou dica a menos de 16 px do bloco seguinte.
 *
 * Quando a dica encerra o contêiner (campo, cabeçalho, linha de ações), a medida vai do
 * contêiner até o irmão dele, desde que esse irmão seja um bloco de largura inteira: um
 * item de grade ao lado fica na mesma linha e não tem distância vertical a conferir.
 *
 * A dica que antecede o próprio controle, outra dica ou a base legal da regra escolhida
 * no campo (`.regra-explicada`, que detalha o campo de cima) fica de fora: ali a
 * proximidade é intencional.
 */
export async function blocosColados(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raiz = document.querySelector('.wiz-content');
    if (!raiz) {
      return ['.wiz-content ausente'];
    }
    const visivel = (e: Element): boolean => e.getBoundingClientRect().height > 0;
    const anterior = (e: Element): Element | null => {
      let irmao = e.previousElementSibling;
      while (irmao && !visivel(irmao)) irmao = irmao.previousElementSibling;
      return irmao;
    };
    const seguinte = (e: Element): Element | null => {
      let irmao = e.nextElementSibling;
      while (irmao && !visivel(irmao)) irmao = irmao.nextElementSibling;
      return irmao;
    };
    const distancia = (de: Element, para: Element): number =>
      para.getBoundingClientRect().top - de.getBoundingClientRect().bottom;
    const texto = (e: Element): string => (e.textContent ?? '').trim().slice(0, 40);
    const PROXIMIDADE_INTENCIONAL =
      'input, select, textarea, label, .input, .field__hint, .field__erro, .regra-explicada';
    const LARGURA_INTEIRA = 'details, .field__hint, .alert, .form-grid, .checkbox-grid';
    const colados: string[] = [];

    for (const titulo of Array.from(
      raiz.querySelectorAll('.step-section__title, .form-section__title'),
    )) {
      const antes = visivel(titulo) ? anterior(titulo) : null;
      if (antes && distancia(antes, titulo) < 20) {
        colados.push(`título "${texto(titulo)}"`);
      }
    }

    for (const bloco of Array.from(raiz.querySelectorAll('.alert, .field__hint'))) {
      if (!visivel(bloco)) continue;
      const depois = seguinte(bloco);
      if (depois) {
        if (!depois.matches(PROXIMIDADE_INTENCIONAL) && distancia(bloco, depois) < 16) {
          colados.push(`bloco "${texto(bloco)}"`);
        }
        continue;
      }
      const pai = bloco.parentElement;
      const irmaoDoPai = pai && pai !== raiz ? seguinte(pai) : null;
      if (pai && irmaoDoPai?.matches(LARGURA_INTEIRA) && distancia(pai, irmaoDoPai) < 16) {
        colados.push(`contêiner da dica "${texto(bloco)}"`);
      }
    }
    return colados;
  });
}

/**
 * Espaços, em px, em volta de dois blocos novos acrescentados logo depois do subtítulo do passo
 * aberto, sem classe nem margem própria: um `div` e um elemento customizado, que é inline por
 * padrão como o host de um componente. O ritmo do passo é que tem de espaçá-los.
 */
export async function espacosDeBlocosNovos(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const host = document.querySelector('.step-pane:not([hidden]) > *');
    const subtitulo = host?.firstElementChild;
    if (!host || !subtitulo) {
      return [];
    }
    const div = document.createElement('div');
    div.textContent = 'Bloco novo';
    const componente = document.createElement('sel-bloco-novo');
    componente.innerHTML = '<p>Componente novo</p>';
    subtitulo.after(div, componente);

    const espaco = (de: Element, para: Element): number =>
      Math.round(para.getBoundingClientRect().top - de.getBoundingClientRect().bottom);
    const espacos = [espaco(subtitulo, div), espaco(div, componente)];
    div.remove();
    componente.remove();
    return espacos;
  });
}

/** O valor de `--space-5` em px, o ritmo entre os blocos do corpo de um passo. */
export async function ritmoDoPasso(page: Page): Promise<number> {
  return page.evaluate(() => {
    const sonda = document.createElement('div');
    sonda.style.height = 'var(--space-5)';
    document.body.append(sonda);
    const altura = Math.round(sonda.getBoundingClientRect().height);
    sonda.remove();
    return altura;
  });
}

export interface EspacoEntreBlocos {
  readonly de: string;
  readonly para: string;
  readonly espaco: number;
}

/**
 * Espaços, em px, entre os blocos visíveis do corpo do passo aberto, na ordem do documento.
 *
 * A medida vai da borda visual de um bloco à do seguinte, e não da caixa: um bloco sem borda,
 * padding nem fundo naquele lado não desenha nada ali, e a margem de um filho que ficou presa
 * dentro dele (numa lista flex, por exemplo) é espaço que o usuário vê. Nesse caso a medida
 * desce até o filho em fluxo mais próximo da borda.
 */
export async function espacosEntreBlocos(page: Page): Promise<EspacoEntreBlocos[]> {
  return page.evaluate(() => {
    const host = document.querySelector('.step-pane:not([hidden]) > *');
    if (!host) {
      return [];
    }
    const emFluxo = (e: Element): boolean => {
      if (e.hasAttribute('hidden')) return false;
      const estilo = getComputedStyle(e);
      return (
        estilo.position !== 'absolute' &&
        estilo.position !== 'fixed' &&
        e.getBoundingClientRect().height > 0
      );
    };
    const CONTROLES = 'button, input, select, textarea, img, svg, video, canvas, iframe';
    const desenhaNaBorda = (e: Element, lado: 'top' | 'bottom'): boolean => {
      const estilo = getComputedStyle(e);
      return (
        e.matches(CONTROLES) ||
        parseFloat(estilo.getPropertyValue(`border-${lado}-width`)) > 0 ||
        parseFloat(estilo.getPropertyValue(`padding-${lado}`)) > 0 ||
        estilo.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        estilo.overflow !== 'visible'
      );
    };
    /*
     * Quem contém linhas de texto vale pela própria caixa: a caixa de um filho inline não
     * coincide com a da linha, e descer até ela mediria a entrelinha, não o espaço do passo.
     */
    const contemLinhas = (e: Element): boolean =>
      Array.from(e.childNodes).some(
        (no) => no.nodeType === Node.TEXT_NODE && no.textContent?.trim(),
      ) ||
      Array.from(e.children).some((filho) => getComputedStyle(filho).display.startsWith('inline'));
    const filhosParaDescer = (e: Element, lado: 'top' | 'bottom'): Element[] =>
      desenhaNaBorda(e, lado) || contemLinhas(e) ? [] : Array.from(e.children).filter(emFluxo);
    const topo = (e: Element): number => {
      const filhos = filhosParaDescer(e, 'top');
      return filhos.length === 0 ? e.getBoundingClientRect().top : Math.min(...filhos.map(topo));
    };
    const base = (e: Element): number => {
      const filhos = filhosParaDescer(e, 'bottom');
      return filhos.length === 0 ? e.getBoundingClientRect().bottom : Math.max(...filhos.map(base));
    };
    const rotulo = (e: Element): string =>
      e.classList.length > 0 ? `.${e.classList[0]}` : e.tagName.toLowerCase();

    const blocos = Array.from(host.children).filter(emFluxo);
    return blocos.slice(1).map((bloco, indice) => ({
      de: rotulo(blocos[indice]),
      para: rotulo(bloco),
      espaco: Math.round(topo(bloco) - base(blocos[indice])),
    }));
  });
}
