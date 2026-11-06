import { afterEach, describe, expect, it } from 'vitest';

import { destinoAcessivel, focarEmAlgum } from './destino-do-foco';

describe('destinoAcessivel', () => {
  afterEach(() => document.body.replaceChildren());

  function montar(html: string): void {
    document.body.innerHTML = `<main><h1 id="titulo" tabindex="-1"></h1></main>${html}`;
  }
  const por = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

  it('escolhe o campo do drawer quando ele está aberto', () => {
    montar('<dialog open><select id="campo"></select></dialog>');

    expect(destinoAcessivel(por('campo'), por('titulo'))).toBe(por('campo'));
  });

  it('cai no título da página quando o drawer está fechado', () => {
    montar('<dialog><select id="campo"></select></dialog>');

    expect(destinoAcessivel(por('campo'), por('titulo'))).toBe(por('titulo'));
  });

  it('ignora o campo desabilitado e o inerte', () => {
    montar('<select id="a" disabled></select><div inert><select id="b"></select></div>');

    expect(destinoAcessivel(por('a'), por('b'), por('titulo'))).toBe(por('titulo'));
  });

  it('com um drawer aberto, não escolhe o que está fora dele', () => {
    montar('<dialog open><select id="campo"></select></dialog>');

    expect(destinoAcessivel(por('titulo'))).toBeNull();
  });

  it('não escolhe nada quando nenhum candidato existe', () => {
    expect(destinoAcessivel(null, null)).toBeNull();
  });
});

describe('focarEmAlgum', () => {
  afterEach(() => document.body.replaceChildren());

  it('leva o foco ao destino quando ele o recebe', () => {
    document.body.innerHTML = '<main><h1 tabindex="-1"></h1></main><input id="campo" />';
    const campo = document.getElementById('campo') as HTMLElement;

    expect(focarEmAlgum(campo)).toBe(true);
    expect(document.activeElement).toBe(campo);
  });

  it('quando o destino não pega o foco, cai na região principal e não no body', () => {
    document.body.innerHTML = '<main id="principal"><h1>Título</h1></main><div id="cego"></div>';
    const cego = document.getElementById('cego') as HTMLElement;

    expect(focarEmAlgum(cego)).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('principal'));
  });

  it('com um drawer aberto, o destino fora dele cai no título do drawer, não na página', () => {
    document.body.innerHTML =
      '<main><h1 id="titulo-pagina" tabindex="-1"></h1></main><div id="fora" tabindex="-1"></div>' +
      '<dialog open><h2 class="uni-drawer__title" id="titulo-drawer" tabindex="-1"></h2></dialog>';

    expect(focarEmAlgum(document.getElementById('fora'))).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('titulo-drawer'));
  });

  it('com um drawer aberto sem título, cai no próprio drawer', () => {
    document.body.innerHTML =
      '<main><h1 tabindex="-1"></h1></main><dialog open id="drawer"></dialog>';

    expect(
      focarEmAlgum(document.getElementById('drawer')?.previousElementSibling as HTMLElement),
    ).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('drawer'));
  });

  it('sem destino utilizável nem alternativa, diz que não houve foco', () => {
    document.body.innerHTML = '<div id="cego"></div>';

    expect(focarEmAlgum(document.getElementById('cego'))).toBe(false);
  });
});
