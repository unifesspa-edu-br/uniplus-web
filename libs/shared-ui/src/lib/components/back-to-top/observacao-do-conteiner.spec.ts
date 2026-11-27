import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObservacaoDoConteiner } from './observacao-do-conteiner';

class ObservadorFalso {
  static instancias: ObservadorFalso[] = [];
  readonly observados: Element[] = [];
  desconectado = false;

  constructor(readonly aoMudar: () => void) {
    ObservadorFalso.instancias.push(this);
  }

  observe(alvo: Element): void {
    this.observados.push(alvo);
  }

  disconnect(): void {
    this.desconectado = true;
  }
}

function conteinerComFilhos(quantidade: number): HTMLElement {
  const conteiner = document.createElement('div');
  for (let i = 0; i < quantidade; i += 1) conteiner.appendChild(document.createElement('p'));
  return conteiner;
}

describe('ObservacaoDoConteiner', () => {
  beforeEach(() => {
    ObservadorFalso.instancias = [];
    vi.stubGlobal('ResizeObserver', ObservadorFalso);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('avisa a rolagem do contêiner e para de avisar depois de parar', () => {
    const aoMudar = vi.fn();
    const observacao = new ObservacaoDoConteiner(aoMudar);
    const conteiner = conteinerComFilhos(0);

    observacao.observar(conteiner);
    conteiner.dispatchEvent(new Event('scroll'));
    observacao.parar();
    conteiner.dispatchEvent(new Event('scroll'));

    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  it('observa o tamanho do contêiner e de cada filho, e avisa quando o tamanho muda', () => {
    const aoMudar = vi.fn();
    const conteiner = conteinerComFilhos(2);

    new ObservacaoDoConteiner(aoMudar).observar(conteiner);

    const [observador] = ObservadorFalso.instancias;
    expect(observador.observados).toEqual([conteiner, ...Array.from(conteiner.children)]);
    observador.aoMudar();
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  it('solta o observador de tamanho ao parar e ao trocar de contêiner', () => {
    const observacao = new ObservacaoDoConteiner(vi.fn());

    observacao.observar(conteinerComFilhos(1));
    observacao.observar(conteinerComFilhos(1));
    observacao.parar();

    expect(ObservadorFalso.instancias).toHaveLength(2);
    expect(ObservadorFalso.instancias.every((observador) => observador.desconectado)).toBe(true);
  });

  it('acompanha só a rolagem quando o navegador não tem observador de tamanho', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const aoMudar = vi.fn();
    const conteiner = conteinerComFilhos(1);

    new ObservacaoDoConteiner(aoMudar).observar(conteiner);
    conteiner.dispatchEvent(new Event('scroll'));

    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  it('não faz nada ao receber um contêiner nulo', () => {
    const aoMudar = vi.fn();

    new ObservacaoDoConteiner(aoMudar).observar(null);

    expect(ObservadorFalso.instancias).toHaveLength(0);
    expect(aoMudar).not.toHaveBeenCalled();
  });
});
