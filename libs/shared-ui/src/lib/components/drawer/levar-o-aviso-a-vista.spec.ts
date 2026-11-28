import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { levarOPrimeiroAvisoAVista } from './levar-o-aviso-a-vista';

const PAINEL = `
  <div class="form-drawer">
    <div class="uni-drawer__body">
      <ui-alert id="geral" variant="danger">Não foi possível salvar</ui-alert>
      <ui-alert id="envio" variant="warning">Envio sem confirmação</ui-alert>
      <form>
        <ui-alert id="informativo" variant="info">Informação</ui-alert>
        <div class="field" id="bloco-nome">
          <input id="nome" aria-invalid="true" />
          <span class="field__error" id="erro-nome">Informe o nome</span>
        </div>
        <div hidden><span class="field__error" id="erro-oculto">Oculto</span></div>
      </form>
      <div class="form-drawer__footer"><button type="submit" id="salvar">Salvar</button></div>
    </div>
  </div>`;

function caixa(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top } as DOMRect;
}

describe('levarOPrimeiroAvisoAVista', () => {
  let raiz: HTMLElement;
  let rolagens: Element[];
  const rolarAte = (id: string): void => {
    expect(rolagens.at(-1)).toBe(raiz.querySelector(`#${id}`));
  };

  beforeEach(() => {
    raiz = document.createElement('div');
    document.body.appendChild(raiz);
    rolagens = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      rolagens.push(this);
    });
  });
  afterEach(() => {
    raiz.remove();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  function montar(html = PAINEL): void {
    raiz.innerHTML = html;
  }

  it('rola o corpo até o primeiro aviso, que é o aviso geral do topo', () => {
    montar();

    levarOPrimeiroAvisoAVista(raiz);

    rolarAte('geral');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      inline: 'nearest',
    });
  });

  it('sem aviso no topo, rola até o bloco do campo recusado', () => {
    montar(PAINEL.replace(/<ui-alert id="(geral|envio)"[^>]*>[^<]*<\/ui-alert>/g, ''));

    levarOPrimeiroAvisoAVista(raiz);

    rolarAte('bloco-nome');
  });

  it('ignora o aviso informativo e a mensagem de bloco oculto', () => {
    montar(
      PAINEL.replace(/<ui-alert id="(geral|envio)"[^>]*>[^<]*<\/ui-alert>/g, '').replace(
        'id="erro-nome"',
        'id="x" hidden',
      ),
    );

    levarOPrimeiroAvisoAVista(raiz);

    expect(rolagens.every((alvo) => alvo.id !== 'informativo' && alvo.id !== 'erro-oculto')).toBe(
      true,
    );
  });

  it('traz o campo com foco de volta à vista quando a rolagem o escondeu', () => {
    montar();
    const nome = raiz.querySelector<HTMLElement>('#nome') as HTMLElement;
    const corpo = raiz.querySelector('.uni-drawer__body') as HTMLElement;
    nome.focus();
    vi.spyOn(
      raiz.querySelector('.uni-drawer__body') as Element,
      'getBoundingClientRect',
    ).mockReturnValue(caixa(0, 500));
    vi.spyOn(
      raiz.querySelector('.form-drawer__footer') as Element,
      'getBoundingClientRect',
    ).mockReturnValue(caixa(440, 500));
    vi.spyOn(nome, 'getBoundingClientRect').mockReturnValue(caixa(600, 640));
    Object.defineProperty(corpo, 'scrollTop', { value: 0, writable: true });

    levarOPrimeiroAvisoAVista(raiz);

    expect(corpo.scrollTop).toBe(200);
  });

  it('mantém a rolagem no aviso quando o campo com foco continua visível', () => {
    montar();
    const nome = raiz.querySelector<HTMLElement>('#nome') as HTMLElement;
    nome.focus();
    vi.spyOn(
      raiz.querySelector('.uni-drawer__body') as Element,
      'getBoundingClientRect',
    ).mockReturnValue(caixa(0, 500));
    vi.spyOn(
      raiz.querySelector('.form-drawer__footer') as Element,
      'getBoundingClientRect',
    ).mockReturnValue(caixa(440, 500));
    vi.spyOn(nome, 'getBoundingClientRect').mockReturnValue(caixa(200, 240));

    levarOPrimeiroAvisoAVista(raiz);

    rolarAte('geral');
  });

  it('com o foco no botão de salvar do rodapé não rola de volta', () => {
    montar();
    (raiz.querySelector('#salvar') as HTMLElement).focus();

    levarOPrimeiroAvisoAVista(raiz);

    rolarAte('geral');
    expect(rolagens).toHaveLength(1);
  });

  it('acha o painel também quando a raiz está dentro dele', () => {
    montar();
    const dentro = raiz.querySelector('form') as HTMLElement;

    levarOPrimeiroAvisoAVista(dentro);

    rolarAte('geral');
  });

  it('rola até a própria mensagem quando o erro do campo não está num bloco de campo', () => {
    montar(
      PAINEL.replace(/<ui-alert id="(geral|envio)"[^>]*>[^<]*<\/ui-alert>/g, '')
        .replace(
          '<div hidden>',
          '<fieldset id="grupo"><span class="field__error" id="erro-do-grupo">Escolha a unidade</span></fieldset><div hidden>',
        )
        .replace(/<div class="field" id="bloco-nome">[\s\S]*?<\/div>/, ''),
    );

    levarOPrimeiroAvisoAVista(raiz);

    rolarAte('erro-do-grupo');
  });

  it('rola até o resumo de recusa feito com a classe de alerta, sem o componente', () => {
    montar(
      PAINEL.replace(
        /<ui-alert id="geral"[^>]*>[^<]*<\/ui-alert>/,
        '<div id="resumo" class="alert alert--danger">Não foi possível publicar</div>',
      ),
    );

    levarOPrimeiroAvisoAVista(raiz);

    rolarAte('resumo');
  });

  it('fora de um painel de formulário não faz nada', () => {
    montar('<form><ui-alert variant="danger">Erro</ui-alert></form>');

    levarOPrimeiroAvisoAVista(raiz);

    expect(rolagens).toHaveLength(0);
  });
});
