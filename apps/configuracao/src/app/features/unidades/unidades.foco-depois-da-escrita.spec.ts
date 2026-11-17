import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CenarioDaPaginaDeUnidades,
  ESCRITA,
  LISTA,
  TITULO_DA_LISTA,
  criado,
  instituto,
  problema,
  reitoria,
  sucesso,
} from './unidades.testing';

describe('UnidadesPage — foco depois da escrita', () => {
  let p: CenarioDaPaginaDeUnidades;

  beforeEach(async () => {
    p = await CenarioDaPaginaDeUnidades.abrir();
  });
  afterEach(() => p.http.verify());

  it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
    await p.abrirEdicao(reitoria);
    (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
    await p.responderAConsultaDasUnidades([reitoria, instituto]);
    expect(document.activeElement).toBe(p.editar(reitoria));
    expect(p.sucessos).toHaveBeenCalledWith('Unidade atualizada');
  });

  it('quem levou o foco a outro campo durante a recarga não o perde para a linha', async () => {
    await p.abrirEdicao(reitoria);
    (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
    await p.propagar();
    const expandir = p.elemento<HTMLButtonElement>('button[aria-label="Expandir REIT"]');
    expandir.focus();
    p.http.expectOne((r) => r.url === LISTA).flush([reitoria, instituto]);
    await p.propagar();
    await p.propagar();
    expect(document.activeElement).toBe(expandir);
  });

  it('cadastro concluído devolve o foco ao botão "Nova unidade"', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...criado());
    await p.responderAConsultaDasUnidades([reitoria, instituto]);
    expect(document.activeElement).toBe(p.novo());
    expect(p.sucessos).toHaveBeenCalledWith('Unidade criada');
  });

  it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
    await p.abrirEdicao(reitoria);
    p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
    await p.propagar();
    expect(document.activeElement).toBe(p.editar(reitoria));
  });

  it('remoção concluída leva o foco ao título quando a linha some da recarga', async () => {
    (await p.confirmarRemocao(reitoria)).flush(...sucesso());
    await p.responderAConsultaDasUnidades([]);
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('escrita com falha na recarga leva o foco ao título da lista', async () => {
    (await p.confirmarRemocao(reitoria)).flush(...sucesso());
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
    await p.propagar();
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('ação iniciada no detalhe devolve o foco à linha da unidade', async () => {
    p.nomeDoNo(reitoria).click();
    await p.propagar();
    p.elemento<HTMLButtonElement>('.cfg-drawer-actions button').click();
    await p.responderAConsultaDasUnidades();
    (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
    await p.responderAConsultaDasUnidades([reitoria, instituto]);

    expect(document.activeElement).toBe(p.editar(reitoria));
  });

  it('cancelar a confirmação aberta pelo detalhe devolve o foco à linha', async () => {
    p.nomeDoNo(reitoria).click();
    await p.propagar();
    [...p.fixture.nativeElement.querySelectorAll('.cfg-drawer-actions button')][1].click();
    await p.propagar();
    p.cancelarDaConfirmacao().click();
    await p.propagar();
    await p.propagar();

    expect(document.activeElement).toBe(p.remover(reitoria));
  });
});
