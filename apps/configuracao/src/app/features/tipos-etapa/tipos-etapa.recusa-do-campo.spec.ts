import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  Pagina,
  montarPagina,
  problema,
  prova,
  recusaDeCampo,
} from './tipos-etapa.testing';

const PAGINAS = 'https://developers.example.test/erros/';
const NOME_TAMANHO = 'uniplus.configuracao.tipo_etapa.nome_tamanho';
const CODIGO_JA_EXISTE = 'uniplus.configuracao.tipo_etapa.codigo_ja_existe';
const CONCEITO_INATIVO = 'uniplus.configuracao.tipo_etapa.conceito_inativo';
const CONCEITO_DUPLICADO = 'uniplus.configuracao.tipo_etapa.conceito_duplicado';

const recusaComPagina = (field: string, code: string, message: string) =>
  problema(422, {
    type: `${PAGINAS}uniplus.validacao`,
    code: 'uniplus.validacao',
    errors: [{ field, code, message }],
  });

/**
 * O jsdom não calcula geometria nem desenha: sem estes retornos o axe desiste das regras de rótulo e
 * de ARIA, e o contraste fica a cargo do E2E. Devolve a função que repõe o que o documento tinha.
 */
function simularGeometriaDoDocumento(): () => void {
  const { elementFromPoint, elementsFromPoint } = document;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  return () => {
    document.elementFromPoint = elementFromPoint;
    document.elementsFromPoint = elementsFromPoint;
  };
}

function conferirAcessibilidade(raiz: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(raiz, {
    rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
  });
}

describe('TiposEtapaPage — recusa do servidor junto ao campo', () => {
  let p: Pagina;
  let restaurarDocumento: () => void;

  beforeEach(async () => {
    restaurarDocumento = simularGeometriaDoDocumento();
    p = await montarPagina();
  });
  afterEach(() => {
    restaurarDocumento();
    p.http.verify();
  });

  const recusar = async (resposta: ReturnType<typeof problema>, url = ESCRITA): Promise<void> => {
    (await p.enviar(url)).flush(...resposta);
    await p.propagar();
    await p.propagar();
  };
  const blocoDe = (id: string): HTMLElement => p.elemento(`ui-recusa-do-campo#${id}`);
  const descricaoDe = (controle: HTMLElement): string =>
    (controle.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');

  it('mostra a mensagem, o código e o link para a página da recusa', async () => {
    await p.abrirCadastro();
    await recusar(recusaComPagina('Nome', NOME_TAMANHO, 'Nome fora do padrão.'));

    const bloco = blocoDe('cfg-etapa-nome-erro');
    const link = bloco.querySelector('a') as HTMLAnchorElement;
    expect(bloco.textContent).toContain('Nome fora do padrão.');
    expect(bloco.querySelector('code')?.textContent).toBe(NOME_TAMANHO);
    expect(link.href).toBe(`${PAGINAS}${NOME_TAMANHO}`);
    expect(link.target).toBe('_blank');
    expect(link.textContent).toContain('abre em nova aba');
  });

  it('sem página para o código, mostra a mensagem e o código, sem link', async () => {
    await p.abrirCadastro();
    await recusar(recusaDeCampo('Nome', 'Nome fora do padrão.'));

    const bloco = blocoDe('cfg-etapa-nome-erro');
    expect(bloco.textContent).toContain('Nome fora do padrão.');
    expect(bloco.querySelector('code')?.textContent).toBe(NOME_TAMANHO);
    expect(bloco.querySelector('a')).toBeNull();
  });

  it('o código já reservado (409, sem lista de erros) leva a página do próprio problema', async () => {
    await p.abrirCadastro();
    await recusar(
      problema(409, {
        type: `${PAGINAS}${CODIGO_JA_EXISTE}`,
        code: CODIGO_JA_EXISTE,
        title: 'Código do tipo de etapa já está reservado',
      }),
    );

    const bloco = blocoDe('cfg-etapa-codigo-erro');
    expect(bloco.textContent).toContain('já está reservado');
    expect(bloco.querySelector('code')?.textContent).toBe(CODIGO_JA_EXISTE);
    expect(bloco.querySelector('a')?.href).toBe(`${PAGINAS}${CODIGO_JA_EXISTE}`);
  });

  it('o campo dos conceitos mostra cada recusa com a sua mensagem, o seu código e a sua página', async () => {
    await p.abrirCadastro();
    await recusar(
      problema(422, {
        type: `${PAGINAS}uniplus.validacao`,
        code: 'uniplus.validacao',
        errors: [
          { field: 'conceitosAdmitidos', code: CONCEITO_INATIVO, message: 'texto da API' },
          { field: 'conceitosAdmitidos', code: CONCEITO_DUPLICADO, message: 'outro texto' },
        ],
      }),
    );

    const recusas = [...blocoDe('cfg-etapa-conceitos-erro').querySelectorAll('.field__error')];
    expect(recusas).toHaveLength(2);
    expect(recusas[0].textContent).toContain('desativado no catálogo');
    expect(recusas[0].textContent).toContain(CONCEITO_INATIVO);
    expect(recusas[1].textContent).toContain('mais de uma vez');
    expect(recusas[1].querySelector('a')?.href).toBe(`${PAGINAS}${CONCEITO_DUPLICADO}`);
  });

  it('o leitor de tela lê, junto do campo, a ajuda, a mensagem e o código da recusa', async () => {
    await p.abrirCadastro();
    await recusar(recusaComPagina('Nome', NOME_TAMANHO, 'Nome fora do padrão.'));

    const descricao = descricaoDe(p.campo('nome'));
    expect(descricao).toContain('Como o tipo aparece');
    expect(descricao).toContain('Nome fora do padrão.');
    expect(descricao).toContain(NOME_TAMANHO);
  });

  it('o campo sem recusa do servidor não aponta para o bloco da recusa', async () => {
    await p.abrirCadastro();

    expect(p.campo('nome').getAttribute('aria-describedby')).toBe('cfg-etapa-nome-ajuda');
    expect(p.fixture.nativeElement.querySelector('ui-recusa-do-campo')).toBeNull();
  });

  it('a validação local do campo continua como texto simples, sem código nem link', async () => {
    await p.abrirCadastro();
    p.preencher('nome', '');
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();

    const erro = p.elemento('#cfg-etapa-nome-erro');
    expect(erro.tagName).toBe('SPAN');
    expect(erro.textContent).toBe('Campo obrigatório.');
  });

  it('o rótulo de cada campo aponta para o controle e não envolve a recusa', async () => {
    await p.abrirCadastro();
    await recusar(recusaComPagina('Nome', NOME_TAMANHO, 'Nome fora do padrão.'));

    for (const [id, nome] of [
      ['cfg-etapa-codigo', 'codigo'],
      ['cfg-etapa-nome', 'nome'],
      ['cfg-etapa-descricao', 'descricao'],
    ]) {
      expect(p.campo(nome).id).toBe(id);
      expect(p.elemento(`label[for="${id}"]`).querySelector('ui-recusa-do-campo')).toBeNull();
    }
  });

  it('o formulário com a recusa visível não tem violação de acessibilidade', async () => {
    await p.abrirCadastro();
    await recusar(recusaComPagina('Nome', NOME_TAMANHO, 'Nome fora do padrão.'));

    const resultado = await conferirAcessibilidade(p.elemento('#cfg-tipo-etapa-form'));

    expect(resultado.violations.map((violacao) => violacao.id)).toEqual([]);
    expect(resultado.passes.map((regra) => regra.id)).toContain('label');
  });

  it('o formulário aberto para edição, com a recusa dos conceitos, não tem violação de acessibilidade', async () => {
    await p.abrirEdicao(prova);
    await recusar(
      recusaComPagina('conceitosAdmitidos', CONCEITO_INATIVO, 'texto da API'),
      `${ESCRITA}/${prova.id}`,
    );

    const resultado = await conferirAcessibilidade(p.elemento('#cfg-tipo-etapa-form'));

    expect(resultado.violations.map((violacao) => violacao.id)).toEqual([]);
    expect(resultado.passes.map((regra) => regra.id)).toContain('label');
  });
});
