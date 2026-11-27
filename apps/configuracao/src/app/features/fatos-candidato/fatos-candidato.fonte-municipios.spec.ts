import { FonteValoresFatoCodigo } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  codigoComRotulo,
  comValoresDeclarados,
  corRaca,
  fonteDoProcesso,
} from './fatos-candidato.fixtures';
import { compilarPaginaUmaVez, montarPagina, type Pagina } from './fatos-candidato.testing';

const ROTULO = 'Municípios da prova presencial';
const MENSAGEM = 'Os valores vêm da declaração de cada processo.';
const fonte = codigoComRotulo(FonteValoresFatoCodigo.MUNICIPIOS_PROVA_PRESENCIAL, ROTULO);
const fato = comValoresDeclarados(corRaca, [], fonte);

describe('fonte dos municípios da prova presencial', () => {
  beforeAll(compilarPaginaUmaVez);
  let pagina: Pagina;

  afterEach(() => {
    pagina.atenderApoios();
    pagina.atenderPendencias();
    pagina.http.verify();
  });

  it('mostra no detalhe o rótulo da fonte, sem o código, e de onde vêm os valores', async () => {
    pagina = await montarPagina([fato]);
    await pagina.acionar(pagina.nomeDaLinha(fato));
    const detalhe = pagina.detalhe();

    expect(detalhe.textContent).toContain(ROTULO);
    expect(detalhe.textContent).not.toContain(fonte.codigo);
    expect(detalhe.querySelector('[role="status"]')?.textContent).toContain(MENSAGEM);
  });

  it('não mostra o aviso quando a fonte é outra', async () => {
    pagina = await montarPagina([comValoresDeclarados(corRaca, [], fonteDoProcesso)]);
    await pagina.acionar(pagina.nomeDaLinha(corRaca));

    expect(pagina.detalhe().textContent).not.toContain(MENSAGEM);
  });

  it('informa a origem na edição sem oferecer o cadastro de valores', async () => {
    pagina = await montarPagina([fato]);
    await pagina.abrirEdicao(fato);
    const edicao = pagina.drawerDoFato();

    const avisos = Array.from(edicao.querySelectorAll('[role="status"]'));
    expect(avisos.some((aviso) => aviso.textContent?.includes(MENSAGEM))).toBe(true);
    expect(edicao.querySelector('#cfg-fato-novo-valor')).toBeNull();
  });
});
