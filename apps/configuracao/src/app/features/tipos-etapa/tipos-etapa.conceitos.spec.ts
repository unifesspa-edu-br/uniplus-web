import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormaDoConceitoCodigo, type TipoConceitoDto } from '@uniplus/shared-data/configuracao';
import {
  CONCEITOS,
  ESCRITA,
  Pagina,
  criado,
  montarPagina,
  problema,
  prova,
  sucesso,
} from './tipos-etapa.testing';

const conceito = (codigo: string, nome: string, ativo = true): TipoConceitoDto => ({
  id: `id-${codigo}`,
  codigo,
  ativo,
  definicao: {
    nome,
    descricao: null,
    natureza: { codigo: FormaDoConceitoCodigo.POR_OPCOES, rotulo: 'Por opções' },
    numerico: null,
    valores: [],
  },
});

const PARECER = conceito('PARECER', 'Parecer');
const ANALISE = conceito('ANALISE', 'Análise');

describe('TiposEtapaPage — conceitos admitidos', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([prova]);
  });
  afterEach(() => p.http.verify());

  const caixas = (): HTMLInputElement[] => [
    ...p.fixture.nativeElement.querySelectorAll('cfg-conceitos-admitidos input[type="checkbox"]'),
  ];
  const rotulos = (): string[] =>
    caixas().map((c) => (c.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim());
  const marcar = async (indice: number): Promise<void> => {
    caixas()[indice].click();
    await p.propagar();
  };
  const corpoDe = (req: { request: { body: unknown } }) =>
    (req.request.body as { avaliacao: { conceitosAdmitidos: string[] } }).avaliacao;

  it('lista os conceitos ativos por nome e grava os escolhidos na criação', async () => {
    await p.abrirCadastro([PARECER, ANALISE, conceito('ANTIGO', 'Antigo', false)]);
    expect(rotulos()).toEqual(['Análise', 'Parecer']);

    await marcar(1);
    const post = await p.enviar();

    expect(corpoDe(post).conceitosAdmitidos).toEqual(['PARECER']);
    post.flush(...criado());
  });

  it('grava lista vazia quando nenhum conceito é escolhido', async () => {
    await p.abrirCadastro([PARECER]);
    const post = await p.enviar();
    expect(corpoDe(post).conceitosAdmitidos).toEqual([]);
    post.flush(...criado());
  });

  it('na edição mostra os admitidos marcados e permite trocar', async () => {
    const tipo = {
      ...prova,
      avaliacao: {
        ...prova.avaliacao,
        conceitosAdmitidos: [
          {
            codigo: 'PARECER',
            nome: 'Parecer',
            natureza: { codigo: FormaDoConceitoCodigo.POR_OPCOES, rotulo: 'Por opções' },
          },
        ],
      },
    };
    p.edicao.abrirEdicao(tipo);
    await p.responderConceitos([PARECER, ANALISE]);
    expect(caixas().map((c) => c.checked)).toEqual([false, true]);

    await marcar(1);
    await marcar(0);
    const put = await p.enviar(`${ESCRITA}/${tipo.id}`);

    expect(corpoDe(put).conceitosAdmitidos).toEqual(['ANALISE']);
    put.flush(...sucesso());
  });

  it('conceito admitido que saiu do catálogo ativo fica marcado como inativo e pode ser retirado', async () => {
    const tipo = {
      ...prova,
      avaliacao: {
        ...prova.avaliacao,
        conceitosAdmitidos: [
          {
            codigo: 'ANTIGO',
            nome: 'Antigo',
            natureza: { codigo: FormaDoConceitoCodigo.POR_OPCOES, rotulo: 'Por opções' },
          },
        ],
      },
    };
    p.edicao.abrirEdicao(tipo);
    await p.responderConceitos([PARECER]);

    expect(rotulos()).toEqual(['Parecer', 'ANTIGO (inativo: retire para salvar)']);
    await marcar(1);
    const put = await p.enviar(`${ESCRITA}/${tipo.id}`);

    expect(corpoDe(put).conceitosAdmitidos).toEqual([]);
    put.flush(...sucesso());
  });

  it('não marca admitido como inativo enquanto o catálogo carrega nem depois de falha', async () => {
    const tipo = {
      ...prova,
      avaliacao: {
        ...prova.avaliacao,
        conceitosAdmitidos: [
          {
            codigo: 'PARECER',
            nome: 'Parecer',
            natureza: { codigo: FormaDoConceitoCodigo.POR_OPCOES, rotulo: 'Por opções' },
          },
        ],
      },
    };
    p.edicao.abrirEdicao(tipo);
    await p.propagar();
    expect(caixas()).toHaveLength(0);

    p.http.expectOne((r) => r.url === CONCEITOS).flush(...problema(500));
    await p.propagar();
    expect(caixas()).toHaveLength(0);
    expect(p.fixture.nativeElement.textContent).not.toContain('inativo');
  });

  it('falha ao carregar o catálogo avisa, não grava e permite tentar de novo', async () => {
    p.edicao.abrirCadastro();
    await p.propagar();
    p.http.expectOne((r) => r.url === CONCEITOS).flush(...problema(500));
    await p.propagar();
    p.preencher('codigo', 'NOVA');
    p.preencher('nome', 'Nova');

    expect(p.fixture.nativeElement.textContent).toContain(
      'Não foi possível carregar os tipos de conceito',
    );
    p.salvar().click();
    await p.propagar();
    p.http.expectNone(ESCRITA);

    p.elemento<HTMLButtonElement>('cfg-conceitos-admitidos ui-falha-de-leitura button').click();
    await p.responderConceitos([PARECER]);
    expect(rotulos()).toEqual(['Parecer']);
  });

  it('mostra no campo a mensagem do código recusado, sem usar o texto da API', async () => {
    await p.abrirCadastro([PARECER]);
    const post = await p.enviar();
    post.flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'conceitosAdmitidos',
            code: 'uniplus.configuracao.tipo_etapa.conceito_inativo',
            message: 'texto interno da API',
          },
        ],
      }),
    );
    await p.propagar();

    const texto = p.elemento('#cfg-etapa-conceitos-erro').textContent ?? '';
    expect(texto).toContain('desativado no catálogo');
    expect(caixas()[0].getAttribute('aria-invalid')).toBe('true');
    expect(texto).not.toContain('texto interno');
    expect(
      p.elemento('cfg-conceitos-admitidos fieldset').getAttribute('aria-describedby'),
    ).toContain('cfg-etapa-conceitos-erro');
  });
});
