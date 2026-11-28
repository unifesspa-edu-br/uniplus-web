import { afterEach, describe, expect, it } from 'vitest';
import {
  FUNDAMENTOS,
  FUNDAMENTOS_DA_API,
  Pagina,
  montarPagina,
} from './motivos-de-decisao.testing';

const TITULO_DA_FALHA = 'Não foi possível salvar';
const TITULO_DO_REENVIO = 'Envio sem confirmação';

describe('MotivoDeDecisaoFormulario — avisos no corpo do painel', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  async function abrirCadastro(): Promise<void> {
    p = await montarPagina([]);
    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
  }

  async function mostrar(falha: boolean, reenvio: boolean): Promise<void> {
    await abrirCadastro();
    p.edicao.erro.set(falha ? 'Falha fictícia ao gravar.' : null);
    p.edicao.aguardandoReenvio.set(reenvio);
    await p.propagar();
  }

  const filhos = (): readonly Element[] => [
    ...p.elemento('cfg-motivo-de-decisao-formulario .uni-drawer__body').children,
  ];
  const avisos = (): readonly Element[] => filhos().filter((f) => f.localName === 'ui-alert');
  const titulos = (): readonly (string | null)[] => avisos().map((a) => a.getAttribute('heading'));

  it('os dois avisos são filhos diretos do corpo, em ordem, antes do formulário', async () => {
    await mostrar(true, true);

    expect(titulos()).toEqual([TITULO_DA_FALHA, TITULO_DO_REENVIO]);
    const formulario = p.elemento('.form-drawer__form');
    expect(filhos().indexOf(formulario)).toBeGreaterThan(filhos().indexOf(avisos()[1]));
  });

  it('um aviso sozinho também é filho direto do corpo, antes do formulário', async () => {
    await mostrar(false, true);

    expect(titulos()).toEqual([TITULO_DO_REENVIO]);
    expect(avisos()[0].nextElementSibling).toBe(p.elemento('.form-drawer__form'));
  });

  it('sem avisos, o corpo não tem alerta e começa pelo formulário', async () => {
    await mostrar(false, false);

    expect(avisos()).toHaveLength(0);
    expect(filhos().find((f) => f.localName !== 'span')).toBe(p.elemento('.form-drawer__form'));
  });

  it('mantém o texto de cada aviso', async () => {
    await mostrar(true, true);

    expect(p.texto('ui-alert[variant="danger"]')).toContain('Falha fictícia ao gravar.');
    expect(p.texto('ui-alert[variant="warning"]')).toContain('Não houve resposta conclusiva');
  });
});
