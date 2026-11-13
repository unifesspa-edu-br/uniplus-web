import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PARECERES } from '../../shared/protecao-do-catalogo/manifestacoes';
import {
  APROVAR,
  CONSULTAR,
  MANIFESTAR,
  SEM_CONTEUDO,
  URL_DA_FILA,
  abrirItem,
  botaoDoRodape,
  campoDaJustificativa,
  clicar,
  detalheDoFato,
  detalheDoLaudo,
  digitar,
  laudo,
  montarPagina,
  problema,
  rural,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

const URL_DA_MANIFESTACAO = `${URL_DA_FILA}/manifestacoes`;
const RAIZ = 'uniplus.configuracao.protecao_do_catalogo.';

describe('ProtecaoDoCatalogoPage — o formulário da manifestação de um item a outro', () => {
  let pagina: PaginaMontada;

  beforeEach(async () => {
    pagina = montarPagina([MANIFESTAR, CONSULTAR]);
    await pagina.carregarFila([laudo, rural]);
  });

  afterEach(() => pagina.encerrar());

  const formulario = () =>
    pagina.tela.querySelector('cfg-manifestacao-do-item form') as HTMLFormElement;
  const parecer = (valor: string) => {
    const rotulo = PARECERES.find((p) => p.valor === valor)?.rotulo;
    return [...formulario().querySelectorAll('label.radio')]
      .find((label) => label.textContent?.trim() === rotulo)
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
  };
  const texto = () => formulario().querySelector('textarea') as HTMLTextAreaElement;
  const manifestacoes = () =>
    pagina.controller.match((r) => r.method === 'POST' && r.url === URL_DA_MANIFESTACAO);

  async function enviar(): Promise<void> {
    formulario().dispatchEvent(new Event('submit'));
    await pagina.assentar();
  }

  it('o texto só de espaços no parecer desfavorável não é enviado e o erro fica ligado ao campo', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    clicar(parecer('INADEQUADA'), 'o parecer inadequada');
    digitar(texto(), '     ');
    await pagina.assentar();
    await enviar();

    expect(manifestacoes()).toHaveLength(0);
    expect(texto().getAttribute('aria-invalid')).toBe('true');
    const erro = formulario().querySelector('#cfg-manifestacao-erro');
    expect(erro?.textContent).toContain('exigem o texto');
    expect(texto().getAttribute('aria-describedby')).toContain('cfg-manifestacao-erro');
  });

  it('fechar o item A sem enviar e abrir o B não leva parecer, texto nem erros do A', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    clicar(parecer('INADEQUADA'), 'o parecer inadequada');
    digitar(texto(), '   ');
    await pagina.assentar();
    await enviar();
    digitar(texto(), 'Texto escrito para o laudo.');
    await pagina.assentar();
    clicar(botaoDoRodape(pagina.tela, 'Fechar'), 'Fechar');
    await pagina.assentar();

    await abrirItem(pagina, rural, detalheDoFato());

    expect(parecer('INADEQUADA')?.checked).toBe(false);
    expect(texto().value).toBe('');
    expect(texto().getAttribute('aria-invalid')).toBeNull();
    expect(formulario().querySelector('.field__error')).toBeNull();

    clicar(parecer('ADEQUADA'), 'o parecer adequada');
    await pagina.assentar();
    await enviar();
    const [envio] = manifestacoes();
    expect(envio?.request.body).toMatchObject({
      cadastro: 'FATO',
      itemId: rural.id,
      parecer: 'ADEQUADA',
      texto: null,
    });
    envio?.flush(null, SEM_CONTEUDO);
    await new Promise((resolver) => setTimeout(resolver));
    await pagina.assentar();
    pagina.controller.expectOne(`${URL_DA_FILA}/fatos/${rural.id}`).flush(detalheDoFato());
  });
});

describe('ProtecaoDoCatalogoPage — a recusa da justificativa vale até a pessoa editá-la', () => {
  let pagina: PaginaMontada;

  beforeEach(async () => {
    pagina = montarPagina([APROVAR]);
    await pagina.carregarFila([laudo]);
  });

  afterEach(() => pagina.encerrar());

  it('ao digitar depois da recusa, o campo deixa de estar marcado como inválido', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    clicar(botaoDoRodape(pagina.tela, 'Aprovar'), 'Aprovar');
    await pagina.assentar();
    clicar(
      [...pagina.tela.querySelectorAll('cfg-decisao-da-protecao-dialogo button')].find(
        (b) => b.textContent?.trim() === 'Aprovar item',
      ),
      'Aprovar item',
    );
    await pagina.assentar();

    const lote = {
      status: 422,
      code: `${RAIZ}justificativa_exigida_pela_manifestacao`,
      title: 'x',
      errors: [{ field: 'justificativa', code: 'a', message: 'Explique a decisão.' }],
    };
    pagina.controller
      .expectOne((r) => r.method === 'POST' && r.url === URL_DA_FILA)
      .flush(JSON.stringify(lote), problema(422, lote.code, 'x')[1]);
    await pagina.assentar();
    expect(campoDaJustificativa(pagina.tela).getAttribute('aria-invalid')).toBe('true');

    digitar(campoDaJustificativa(pagina.tela), 'A classificação interna basta.');
    await pagina.assentar();

    expect(campoDaJustificativa(pagina.tela).getAttribute('aria-invalid')).not.toBe('true');
  });
});
