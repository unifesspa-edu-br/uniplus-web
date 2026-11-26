import {
  ClassificacaoDeProtecaoCodigo,
  EscopoFatoCodigo,
  HipoteseLegalTratamentoCodigo,
  OrigemFatoCodigo,
  TipoDoDadoCodigo,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { codigoComRotulo, comDefinicao, trabalha } from './fatos-candidato.fixtures';
import {
  compilarPaginaUmaVez,
  montarPagina,
  problema,
  type Pagina,
} from './fatos-candidato.testing';
import { VOCABULARIOS_DO_FATO } from './vocabularios-do-fato.testing';

describe('vocabulários publicados para fatos', () => {
  beforeAll(compilarPaginaUmaVez);
  let pagina: Pagina;

  afterEach(() => {
    pagina.atenderApoios();
    pagina.atenderPendencias();
    pagina.http.verify();
  });

  function conferirOpcoes(seletor: string, itens: readonly { codigo: string; rotulo: string }[]) {
    const campo = pagina.elemento<HTMLSelectElement>(seletor);
    const opcoes = [...campo.options].filter((opcao) => opcao.value);
    expect(opcoes.map((opcao) => [opcao.value, opcao.textContent?.trim()])).toEqual(
      itens.map((item) => [item.codigo, item.rotulo]),
    );
  }

  it('apresenta os componentes, quantidades e escopos publicados', async () => {
    pagina = await montarPagina();
    await pagina.abrirCriacao();
    conferirOpcoes('#cfg-fato-componente', VOCABULARIOS_DO_FATO['componentes-de-exibicao']);
    conferirOpcoes('#cfg-fato-cardinalidades', VOCABULARIOS_DO_FATO['quantidades-de-valores']);
    conferirOpcoes('#cfg-fato-escopos', VOCABULARIOS_DO_FATO['escopos-fato']);
    expect(pagina.texto('#cfg-fato-componente')).toContain('Valor em reais');
    expect(pagina.texto('#cfg-fato-componente')).not.toContain('Moeda');
  });

  it('apresenta as fontes e os formatos publicados para seus tipos de dado', async () => {
    pagina = await montarPagina();
    await pagina.abrirCriacao();
    pagina.digitar('#cfg-fato-dominio', TipoDoDadoCodigo.OPCAO);
    await pagina.propagar();
    conferirOpcoes('#cfg-fato-fontes', VOCABULARIOS_DO_FATO['fontes-valores-fato']);
    pagina.digitar('#cfg-fato-dominio', TipoDoDadoCodigo.TEXTO);
    await pagina.propagar();
    conferirOpcoes('#cfg-fato-formatos', VOCABULARIOS_DO_FATO['formatos-texto']);
  });

  it('apresenta cada origem publicada no filtro', async () => {
    pagina = await montarPagina();
    const filtro = pagina.elemento('[aria-label="Filtrar por origem"]');
    const rotulos = [...filtro.querySelectorAll('button')].map((botao) =>
      botao.textContent?.trim(),
    );
    expect(rotulos).toEqual([
      'Todas',
      ...VOCABULARIOS_DO_FATO['origens-fato'].map((item) => item.rotulo),
    ]);
    expect(VOCABULARIOS_DO_FATO['origens-fato'].map((item) => item.codigo).sort()).toEqual(
      Object.values(OrigemFatoCodigo).sort(),
    );
  });

  it('oferece as hipóteses publicadas que cabem na classificação', async () => {
    pagina = await montarPagina();
    await pagina.abrirCriacao();
    pagina.digitar(
      '[formControlName="classificacaoProtecao"]',
      ClassificacaoDeProtecaoCodigo.PESSOAL,
    );
    await pagina.propagar();
    const comuns = VOCABULARIOS_DO_FATO['hipoteses-legais-tratamento'].filter(
      (item) => item.codigo !== HipoteseLegalTratamentoCodigo.PREVENCAO_A_FRAUDE,
    );
    conferirOpcoes('#cfg-fato-hipoteses', comuns);
    pagina.digitar(
      '[formControlName="classificacaoProtecao"]',
      ClassificacaoDeProtecaoCodigo.SENSIVEL,
    );
    await pagina.propagar();
    const comunsExcluidas = [
      HipoteseLegalTratamentoCodigo.EXECUCAO_CONTRATO,
      HipoteseLegalTratamentoCodigo.INTERESSE_LEGITIMO,
      HipoteseLegalTratamentoCodigo.PROTECAO_DO_CREDITO,
    ];
    conferirOpcoes(
      '#cfg-fato-hipoteses',
      VOCABULARIOS_DO_FATO['hipoteses-legais-tratamento'].filter(
        (item) => !comunsExcluidas.includes(item.codigo),
      ),
    );
  });

  it('exibe o rótulo recebido para um escopo desconhecido', async () => {
    const fato = comDefinicao(trabalha, {
      escopo: codigoComRotulo('FUTURO' as EscopoFatoCodigo, 'Escopo informado pela API'),
    });
    pagina = await montarPagina([fato]);
    await pagina.acionar(pagina.nomeDaLinha(fato));
    pagina.http.match((r) => r.url.includes('/atos')).forEach((r) => r.flush([]));
    await pagina.propagar();
    expect(pagina.texto('dialog[aria-label="Detalhe do fato do candidato"]')).toContain(
      'Escopo informado pela API',
    );
  });

  it('avisa sobre falha no carregamento e tenta novamente', async () => {
    pagina = await montarPagina();
    await pagina.acionar(pagina.novo());
    const url = '/api/configuracao/vocabularios/componentes-de-exibicao';
    pagina.http.expectOne((pedido) => pedido.url.endsWith(url)).flush(...problema(500));
    pagina.atenderApoios();
    await pagina.propagar();
    const campo = pagina.elemento('#cfg-fato-componente').closest('label');
    expect(campo?.textContent).toContain('Não foi possível carregar');
    const botao = campo?.querySelector('button');
    expect(botao).not.toBeNull();
    if (botao) await pagina.acionar(botao);
    pagina.http
      .expectOne((pedido) => pedido.url.endsWith(url))
      .flush(VOCABULARIOS_DO_FATO['componentes-de-exibicao']);
    await pagina.propagar();
    conferirOpcoes('#cfg-fato-componente', VOCABULARIOS_DO_FATO['componentes-de-exibicao']);
  });
});
