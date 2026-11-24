import { StatusProcessoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PaginaDePublicacoes,
  item,
  previstos,
  botao,
} from './publicacoes-do-processo.page.testing';

describe('PublicacoesDoProcessoPage — publicar documento', () => {
  let pagina: PaginaDePublicacoes;

  beforeEach(() => {
    pagina = new PaginaDePublicacoes();
  });

  afterEach(() => pagina.controller.verify());

  it('não permite publicar antes de o processo ser publicado', async () => {
    await pagina.abrir(StatusProcessoCodigo.rascunho, []);

    expect(pagina.host.textContent).toContain('O processo ainda não foi publicado');
    expect(pagina.host.querySelector('sel-atos-do-processo')).toBeNull();
    const publicar = Array.from(pagina.host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Publicar documento',
    ) as HTMLButtonElement;
    expect(publicar.disabled).toBe(true);
  });

  it('sem a permissão de publicar, não oferece publicar nem corrigir, mesmo com o processo publicado', async () => {
    pagina.permissoesConcedidas = ['selecao:processos:configurar', 'selecao:processos:acompanhar'];

    await pagina.abrir(StatusProcessoCodigo.publicado, [], previstos(item('preliminar')));

    const textos = Array.from(pagina.host.querySelectorAll('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(textos).not.toContain('Publicar documento');
    expect(botao(pagina.linhasDosPrevistos()[0], 'Publicar')).toBeUndefined();
    expect(pagina.host.querySelector('sel-atos-do-processo')?.textContent).not.toContain(
      'Corrigir',
    );
  });

  it('com a permissão de publicar e o processo publicado, oferece "Publicar documento" habilitado', async () => {
    await pagina.abrir(StatusProcessoCodigo.publicado, []);

    const publicar = Array.from(pagina.host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Publicar documento',
    ) as HTMLButtonElement;
    expect(publicar.disabled).toBe(false);
  });
});
