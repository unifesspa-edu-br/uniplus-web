import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  APROVAR,
  SEM_CONTEUDO,
  URL_DA_FILA,
  abrirItem,
  botaoDoRodape,
  botaoPorTexto,
  campoDaJustificativa,
  clicar,
  detalheDoLaudo,
  dialogoDaDecisao,
  digitar,
  drawerDoItem,
  laudo,
  manifestacao,
  montarPagina,
  problema,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

const RAIZ = 'uniplus.configuracao.protecao_do_catalogo.';
const URL_DO_DETALHE = `${URL_DA_FILA}/tipos-documento/${laudo.id}`;
const URL_DO_HISTORICO = `${URL_DO_DETALHE}/manifestacoes`;

const comManifestacao = (desfavoravel: boolean) => ({
  ...detalheDoLaudo,
  aprovacao: {
    ...detalheDoLaudo.aprovacao,
    manifestadaEm: '2026-11-02T14:00:00Z',
    manifestacaoDesfavoravel: desfavoravel,
    manifestacoesNoCiclo: 1,
  },
  manifestacoesVigentes: [manifestacao({ parecer: desfavoravel ? 'INADEQUADA' : 'ADEQUADA' })],
});

describe('ProtecaoDoCatalogoPage — decisão diante de manifestação técnica', () => {
  let pagina: PaginaMontada;

  beforeEach(async () => {
    pagina = montarPagina([APROVAR]);
    await pagina.carregarFila([laudo]);
  });

  afterEach(() => pagina.encerrar());

  const decisoes = () =>
    pagina.controller.match((r) => r.method === 'POST' && r.url === URL_DA_FILA);
  const dialogo = () => dialogoDaDecisao(pagina.tela) as HTMLElement;

  async function aprovarPeloDialogo(justificativa?: string): Promise<void> {
    clicar(botaoDoRodape(pagina.tela, 'Aprovar'), 'Aprovar');
    await pagina.assentar();
    if (justificativa !== undefined) digitar(campoDaJustificativa(pagina.tela), justificativa);
    clicar(botaoPorTexto(dialogo(), 'Aprovar item'));
    await pagina.assentar();
  }

  it('diante de manifestação desfavorável vigente, a aprovação exige a justificativa', async () => {
    await abrirItem(pagina, laudo, comManifestacao(true));
    await aprovarPeloDialogo();

    expect(dialogo().textContent).toContain('Inadequada');
    expect(decisoes()).toHaveLength(0);
    expect(campoDaJustificativa(pagina.tela).getAttribute('aria-invalid')).toBe('true');
    expect(dialogo().textContent).toContain(
      'Há manifestação desfavorável vigente: informe a justificativa da decisão.',
    );
  });

  it('com a justificativa, a aprovação leva o texto aparado', async () => {
    await abrirItem(pagina, laudo, comManifestacao(true));
    await aprovarPeloDialogo('  A classificação interna basta.  ');

    const [envio] = decisoes();
    expect(envio?.request.body).toMatchObject({
      decisao: 'APROVAR',
      justificativa: 'A classificação interna basta.',
    });
    envio?.flush(null, SEM_CONTEUDO);
  });

  it('diante só de manifestação favorável, a justificativa é opcional', async () => {
    await abrirItem(pagina, laudo, comManifestacao(false));
    await aprovarPeloDialogo();

    const [envio] = decisoes();
    expect(envio?.request.body).toMatchObject({ decisao: 'APROVAR', justificativa: null });
    envio?.flush(null, SEM_CONTEUDO);
  });

  it('sem manifestação vigente, a aprovação passa pelo diálogo e aceita a justificativa opcional', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    await aprovarPeloDialogo('  Conferida com a área.  ');

    expect(decisoes()[0]?.request.body).toMatchObject({
      decisao: 'APROVAR',
      justificativa: 'Conferida com a área.',
    });
  });

  it('o lote de erros da decisão vai à justificativa e à classificação recomendada de uma vez', async () => {
    await abrirItem(pagina, laudo, comManifestacao(true));
    clicar(botaoDoRodape(pagina.tela, 'Recomendar ajuste'), 'Recomendar ajuste');
    await pagina.assentar();
    const select = dialogo().querySelector('select') as HTMLSelectElement;
    select.value = select.options[1]?.value ?? '';
    select.dispatchEvent(new Event('change'));
    digitar(campoDaJustificativa(pagina.tela), 'Recomendo outra.');
    clicar(botaoPorTexto(dialogo(), 'Recomendar ajuste'));
    await pagina.assentar();

    const lote = {
      status: 422,
      code: `${RAIZ}justificativa_exigida_pela_manifestacao`,
      title: 'x',
      errors: [
        {
          field: 'justificativa',
          code: 'a',
          message: 'Explique a decisão diante da manifestação.',
        },
        { field: 'classificacaoRecomendada', code: 'b', message: 'A classificação não cabe.' },
      ],
    };
    decisoes()[0]?.flush(JSON.stringify(lote), problema(422, lote.code, 'x')[1]);
    await pagina.assentar();

    expect(dialogo().textContent).toContain('Explique a decisão diante da manifestação.');
    expect(dialogo().textContent).toContain('A classificação não cabe.');
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('o conflito retentável na decisão se repete uma vez, com a mesma chave', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    await aprovarPeloDialogo();

    const [primeira] = decisoes();
    const chave = primeira?.request.headers.get('Idempotency-Key');
    primeira?.flush(
      JSON.stringify({
        status: 409,
        code: `${RAIZ}conflito_de_concorrencia`,
        title: 'x',
        retryable: true,
      }),
      problema(409, `${RAIZ}conflito_de_concorrencia`, 'x')[1],
    );
    await pagina.assentar();

    const [segunda] = decisoes();
    expect(segunda?.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda?.flush(null, SEM_CONTEUDO);
    await pagina.assentar();
    pagina.controller.expectOne((r) => r.method === 'GET' && r.url === URL_DA_FILA).flush([]);
  });

  it('a decisão leva o ciclo e a contagem de manifestações lidos na aprovação', async () => {
    await abrirItem(pagina, laudo, comManifestacao(false));
    await aprovarPeloDialogo();

    const [envio] = decisoes();
    expect(envio?.request.body).toMatchObject({ ciclo: 2, manifestacoesNoCiclo: 1 });
    envio?.flush(null, SEM_CONTEUDO);
  });

  it('com manifestação nova depois da leitura (409), relê o item, avisa no drawer e não reenvia', async () => {
    await abrirItem(pagina, laudo, comManifestacao(false));
    await aprovarPeloDialogo();

    decisoes()[0]?.flush(...problema(409, `${RAIZ}manifestacao_nao_lida`, 'Há manifestação nova'));
    await pagina.assentar();

    expect(dialogo().hasAttribute('open')).toBe(false);
    expect(drawerDoItem(pagina.tela)?.textContent).toContain('O item foi relido');
    pagina.controller.expectOne(URL_DO_DETALHE).flush(comManifestacao(true));
    await pagina.assentar();
    expect(decisoes()).toHaveLength(0);
    pagina.controller.expectNone((r) => r.method === 'GET' && r.url === URL_DA_FILA);
  });

  it('o conflito retentável repetido com a mesma chave que recebe manifestacao_nao_lida não se repete de novo: relê o item e mostra a recusa', async () => {
    await abrirItem(pagina, laudo, comManifestacao(false));
    await aprovarPeloDialogo();
    const [primeira] = decisoes();
    const chave = primeira?.request.headers.get('Idempotency-Key');
    primeira?.flush(
      JSON.stringify({
        status: 409,
        code: `${RAIZ}conflito_de_concorrencia`,
        title: 'x',
        retryable: true,
      }),
      problema(409, `${RAIZ}conflito_de_concorrencia`, 'x')[1],
    );
    await pagina.assentar();

    const [segunda] = decisoes();
    expect(segunda?.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda?.flush(...problema(409, `${RAIZ}manifestacao_nao_lida`, 'Há manifestação nova'));
    await pagina.assentar();

    expect(decisoes()).toHaveLength(0);
    expect(dialogo().hasAttribute('open')).toBe(false);
    expect(drawerDoItem(pagina.tela)?.textContent).toContain('O item foi relido');
    pagina.controller.expectOne(URL_DO_DETALHE).flush(comManifestacao(true));
    await pagina.assentar();
    expect(decisoes()).toHaveLength(0);
  });

  it('o lote com a proteção mudada e a manifestação não lida relê a fila e avisa uma vez, com os dois motivos', async () => {
    await abrirItem(pagina, laudo, comManifestacao(false));
    await aprovarPeloDialogo();
    const lote = {
      status: 409,
      code: `${RAIZ}protecao_mudou`,
      title: 'A proteção do item mudou',
      errors: [
        {
          field: 'classificacaoProtecao',
          code: `${RAIZ}protecao_mudou`,
          message: 'A classificação mudou.',
        },
        { field: 'hipoteseLegal', code: `${RAIZ}protecao_mudou`, message: 'A hipótese mudou.' },
        {
          field: 'manifestacoesNoCiclo',
          code: `${RAIZ}manifestacao_nao_lida`,
          message: 'Há manifestação nova.',
        },
      ],
    };

    decisoes()[0]?.flush(JSON.stringify(lote), problema(409, lote.code, 'x')[1]);
    await pagina.assentar();
    pagina.controller.expectOne((r) => r.method === 'GET' && r.url === URL_DA_FILA).flush([laudo]);
    await pagina.assentar();

    const avisos = [...pagina.tela.querySelectorAll('ui-alert')]
      .map((a) => a.textContent ?? '')
      .filter((texto) => texto.includes('A proteção do item mudou'));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('Também entrou manifestação técnica depois da leitura');
    expect(drawerDoItem(pagina.tela)?.hasAttribute('open')).toBe(false);
    pagina.controller.expectNone(URL_DO_DETALHE);
    expect(decisoes()).toHaveLength(0);
  });

  it('a proteção mudada sem manifestação nova não fala de manifestação no aviso', async () => {
    await abrirItem(pagina, laudo, comManifestacao(false));
    await aprovarPeloDialogo();

    decisoes()[0]?.flush(...problema(409, `${RAIZ}protecao_mudou`, 'A proteção do item mudou'));
    await pagina.assentar();
    pagina.controller.expectOne((r) => r.method === 'GET' && r.url === URL_DA_FILA).flush([laudo]);
    await pagina.assentar();

    expect(pagina.tela.textContent).toContain('A proteção do item mudou');
    expect(pagina.tela.textContent).not.toContain('Também entrou manifestação técnica');
  });

  it('o histórico das manifestações mostra a situação de cada uma e a que ela substituiu', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    pagina.controller.expectOne(URL_DO_HISTORICO).flush([
      manifestacao({ id: 'a', situacao: 'SUBSTITUIDA', instante: '2026-11-02T14:00:00Z' }),
      manifestacao({
        id: 'b',
        parecer: 'ADEQUADA',
        texto: null,
        substituiId: 'a',
        instante: '2026-11-03T10:00:00Z',
      }),
      manifestacao({ id: 'c', ciclo: 1, situacao: 'ENCERRADA' }),
    ]);
    await pagina.assentar();

    const historico = pagina.tela.querySelector(
      '[aria-label="Histórico das manifestações técnicas"]',
    );
    const texto = historico?.textContent?.replace(/\s+/gu, ' ') ?? '';
    expect(texto).toContain('Substituída');
    expect(texto).toContain('Vigente');
    expect(texto).toContain('De ciclo encerrado');
    expect(texto).toContain('Substitui a manifestação de 02/11/2026');
  });

  it('com o registro de acesso fora do ar (503), o histórico mostra a falha sem dado e tenta de novo', async () => {
    await abrirItem(pagina, laudo, detalheDoLaudo);
    pagina.controller
      .expectOne(URL_DO_HISTORICO)
      .flush(
        ...problema(
          503,
          'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar',
          'Registro de acesso indisponível',
        ),
      );
    await pagina.assentar();

    expect(
      pagina.tela.querySelector('[aria-label="Histórico das manifestações técnicas"]'),
    ).toBeNull();
    clicar(botaoPorTexto(pagina.tela, 'Tentar novamente'));
    await pagina.assentar();
    pagina.controller.expectOne(URL_DO_HISTORICO).flush([]);
  });
});
