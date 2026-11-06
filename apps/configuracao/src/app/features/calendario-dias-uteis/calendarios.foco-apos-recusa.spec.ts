import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CALENDARIO_ANTERIOR,
  CALENDARIO_VIGENTE,
  CONFLITO_DE_CONCORRENCIA,
  JA_VIGENTE,
  NAO_ENCONTRADO,
  PaginaDaLista,
  TITULO_DA_LISTA,
  montarLista,
  problema,
} from './calendarios.testing';

describe('CalendarioDiasUteisListPage — foco ao fechar a confirmação após recusa que relê a lista', () => {
  let p: PaginaDaLista;

  beforeEach(async () => {
    p = await montarLista();
  });
  afterEach(() => p.http.verify());

  const cancelar = async (qual: 'remocao' | 'vigencia'): Promise<void> => {
    p.cancelarDaConfirmacao(qual).click();
    await p.propagar();
    await new Promise((resolve) => setTimeout(resolve));
  };

  it('a recusa 404 da remoção, com a linha ausente da lista relida, leva o foco ao título', async () => {
    const del = await p.confirmarRemocao();
    del.flush(...problema(404, { code: NAO_ENCONTRADO, title: 'Calendário não encontrado' }));
    await p.recarregarCom([CALENDARIO_VIGENTE]);
    expect(
      p.fixture.nativeElement.querySelector('tr[data-calendario-id]:nth-of-type(2)'),
    ).toBeNull();

    await cancelar('remocao');

    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('a recusa 409 da remoção, com a linha mantida e habilitada, devolve o foco ao botão da linha', async () => {
    const del = await p.confirmarRemocao();
    del.flush(...problema(409, { code: CONFLITO_DE_CONCORRENCIA, title: 'Conflito' }));
    await p.recarregarCom([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);

    await cancelar('remocao');

    expect(document.activeElement).toBe(p.remover());
  });

  it('a recusa ja_vigente, com o botão da linha agora indisponível, leva o foco ao título', async () => {
    const post = await p.confirmarVigencia();
    post.flush(...problema(409, { code: JA_VIGENTE, title: 'Este dataset já é o vigente' }));
    await p.recarregarCom([
      { ...CALENDARIO_VIGENTE, vigente: false },
      { ...CALENDARIO_ANTERIOR, vigente: true },
    ]);
    expect(p.marcarVigente().disabled).toBe(true);

    await cancelar('vigencia');

    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('cancelar antes de a releitura terminar leva o foco ao título, e o fim da releitura não o tira dali', async () => {
    const post = await p.confirmarVigencia();
    post.flush(...problema(409, { code: CONFLITO_DE_CONCORRENCIA, title: 'Conflito' }));
    await p.propagar();
    expect(p.edicao.gravando()).toBe(true);

    await cancelar('vigencia');
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));

    await p.recarregarCom([CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR]);
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('a recusa que não relê a lista deixa o foco com o diálogo ao fechar', async () => {
    const del = await p.confirmarRemocao();
    del.flush(...problema(500, { code: 'uniplus.erro_interno', title: 'Erro interno' }));
    await p.propagar();

    await cancelar('remocao');

    expect(document.activeElement).not.toBe(p.elemento(TITULO_DA_LISTA));
  });
});
