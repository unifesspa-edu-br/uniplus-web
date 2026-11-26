import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONFLITO,
  ERRO_INTERNO,
  ESCRITA,
  NAO_ENCONTRADA,
  Pagina,
  TITULO_DA_LISTA,
  inscricaoHomologacao,
  montarPagina,
  problema,
  sucesso,
} from './precedencias-fase.testing';

describe('PrecedenciasFasePage — recusas do servidor ao remover', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const lerMensagem = (): string | undefined =>
    p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();

  it('recusa (409) mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
    const primeira = await p.confirmarRemocao(inscricaoHomologacao);
    primeira.flush(...problema(409, CONFLITO));
    await p.propagar();

    expect(lerMensagem()).toBe(CONFLITO.title);
    expect(p.edicao.confirmando()).toBe(true);
    expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(p.confirmar());
    expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
      'Não foi possível remover a aresta INSCRICAO → HOMOLOGACAO_INSCRICOES.',
    );
    expect(p.erros).not.toHaveBeenCalled();
    expect(p.sucessos).not.toHaveBeenCalled();

    p.confirmar().click();
    await p.propagar();
    p.http.expectOne(`${ESCRITA}/${inscricaoHomologacao.id}`).flush(...sucesso());
    await p.recarregarCom([]);
    expect(p.edicao.confirmando()).toBe(false);
  });

  it('aresta já removida (404) mantém a mensagem no diálogo e recarrega a lista, sem toast', async () => {
    (await p.confirmarRemocao(inscricaoHomologacao)).flush(...problema(404, NAO_ENCONTRADA));
    await p.propagar();

    expect(lerMensagem()).toBe(NAO_ENCONTRADA.title);
    expect(p.erros).not.toHaveBeenCalled();
    await p.recarregarCom([]);
    expect(p.edicao.confirmando()).toBe(true);
  });

  it('cancelar depois que a recarga tirou a linha leva o foco ao título da lista', async () => {
    (await p.confirmarRemocao(inscricaoHomologacao)).flush(...problema(404, NAO_ENCONTRADA));
    await p.recarregarCom([]);
    expect(p.edicao.confirmando()).toBe(true);

    p.cancelarDaConfirmacao().click();
    await p.propagar();
    await p.propagar();

    expect(p.edicao.confirmando()).toBe(false);
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('remover durante a recarga não apaga a recusa nem envia', async () => {
    (await p.confirmarRemocao(inscricaoHomologacao)).flush(...problema(404, NAO_ENCONTRADA));
    await p.propagar();
    expect(p.edicao.gravando()).toBe(true);
    expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');

    p.confirmar().click();
    p.edicao.removerConfirmado();
    await p.propagar();

    p.http.expectNone(`${ESCRITA}/${inscricaoHomologacao.id}`);
    expect(lerMensagem()).toBe(NAO_ENCONTRADA.title);
    await p.recarregarCom([]);
  });

  it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
    (await p.confirmarRemocao(inscricaoHomologacao)).flush(...problema(500, ERRO_INTERNO));
    await p.propagar();

    expect(lerMensagem()).toBe(ERRO_INTERNO.title);
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(p.confirmar());
    p.cancelarDaConfirmacao().click();
    await p.propagar();
    expect(document.activeElement).toBe(p.remover());
  });
});
