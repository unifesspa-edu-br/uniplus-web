import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  Pagina,
  analiseDocumental,
  criado,
  montarPagina,
  prova,
  sucesso,
} from './tipos-etapa.testing';

const exigente = { ...analiseDocumental, exigeCorrecaoIndependente: true };

describe('TiposEtapaPage — correção independente', () => {
  let p: Pagina;

  afterEach(() => p.http.verify());

  const celulaDaCorrecao = (codigo: string): string | undefined => {
    const linhas = [...p.fixture.nativeElement.querySelectorAll('tbody tr')] as HTMLElement[];
    return linhas
      .find((linha) => linha.textContent?.includes(codigo))
      ?.querySelector('td[data-label="Correção independente"]')
      ?.textContent?.trim();
  };

  it('a lista indica quais tipos exigem correção independente', async () => {
    p = await montarPagina([exigente, prova]);

    expect(celulaDaCorrecao('ANALISE_DOCUMENTAL')).toBe('Exige');
    expect(celulaDaCorrecao('PROVA')).toBe('Não exige');
  });

  it('o cadastro abre com o checkbox desmarcado e o envia como declarado', async () => {
    p = await montarPagina([prova]);
    await p.abrirCadastro();
    expect(p.campo('exigeCorrecaoIndependente').checked).toBe(false);

    const post = await p.enviar();
    expect(post.request.body).toMatchObject({ exigeCorrecaoIndependente: false });
    post.flush(...criado());
    await p.recarregarCom([prova]);
  });

  it('na edição o checkbox traz o que o tipo declara e a atualização o devolve', async () => {
    p = await montarPagina([exigente, prova]);
    await p.abrirEdicao(exigente);
    expect(p.campo('exigeCorrecaoIndependente').checked).toBe(true);

    const put = await p.enviar(`${ESCRITA}/${exigente.id}`);
    expect(put.request.body).toMatchObject({
      id: exigente.id,
      exigeCorrecaoIndependente: true,
    });
    put.flush(...sucesso());
    await p.recarregarCom([exigente, prova]);
  });

  it('desmarcar o checkbox na edição envia a exigência retirada', async () => {
    p = await montarPagina([exigente, prova]);
    await p.abrirEdicao(exigente);
    p.campo('exigeCorrecaoIndependente').click();

    const put = await p.enviar(`${ESCRITA}/${exigente.id}`);
    expect(put.request.body).toMatchObject({ exigeCorrecaoIndependente: false });
    put.flush(...sucesso());
    await p.recarregarCom([exigente, prova]);
  });
});
