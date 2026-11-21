import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  TipoRenderizacaoCodigo,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  type ErroDeCampo,
  fato,
  modelo,
  montarTelaDeEdicao,
  propagarAlteracoes,
  recusarGravacao,
  responderCarga,
  salvar,
  SEM_REGRAS_DO_CAMPO,
} from './modelo-formulario-edicao.page.testing';

type ConteudoDoModelo = ModeloFormularioView['conteudo'];
type Campo = ConteudoDoModelo['itens'][number];

const TEXTO_NAO_GRAVAVEL = 'uniplus.configuracao.modelo_formulario.texto_nao_gravavel';
const OBRIGATORIEDADE_INVALIDA = 'uniplus.configuracao.modelo_formulario.obrigatoriedade_invalida';

const [dadosBasicos, escolaPublica] = modelo.conteudo.itens;
const [termoLgpd] = modelo.conteudo.termos;
const [grupoFamilia] = modelo.conteudo.grupos;

const umCampo = (fatoCodigo: string, ordem: number, etapaCodigo: string | null): Campo => ({
  ...escolaPublica,
  fatoCodigo,
  ordem,
  apresentacao: {
    rotulo: `Campo ${fatoCodigo}`,
    tipoRenderizacao: TipoRenderizacaoCodigo.BOOLEANO,
    ajuda: null,
    pedirConfirmacao: false,
  },
  etapaCodigo,
  regras: SEM_REGRAS_DO_CAMPO,
});

/**
 * Dois campos, dois grupos (o primeiro com dois campos), dois termos e os dois documentos do
 * modelo base: cada índice recusado tem um vizinho que não pode receber a mensagem.
 */
const modeloDoContrato: ModeloFormularioView = {
  ...modelo,
  conteudo: {
    ...modelo.conteudo,
    itens: [dadosBasicos, escolaPublica, umCampo('GESTANTE', 2, 'SECAO_1')],
    grupos: [
      {
        ...grupoFamilia,
        subitens: [umCampo('PARENTESCO', 0, null), umCampo('OCUPACAO', 1, null)],
      },
      { ...grupoFamilia, codigo: 'RENDA', rotulo: 'Renda familiar', ordem: 3, subitens: [] },
    ],
    termos: [
      termoLgpd,
      { ...termoLgpd, codigo: 'USO_DE_IMAGEM', ordem: 1, termo: { termoId: 'T2', versaoId: 'V1' } },
    ],
  },
};

const ITEM_0 = 'cfg-modelo-item-ESCOLA_PUBLICA-titulo';
const ITEM_1 = 'cfg-modelo-item-GESTANTE-titulo';
const GRUPO_0 = 'cfg-modelo-grupo-FAMILIA-titulo';
const GRUPO_1 = 'cfg-modelo-grupo-RENDA-titulo';
const SUBITEM_0 = 'cfg-modelo-grupo-FAMILIA-campo-PARENTESCO-titulo';
const SUBITEM_1 = 'cfg-modelo-grupo-FAMILIA-campo-OCUPACAO-titulo';
const TERMO_0 = 'cfg-modelo-termo-LGPD-titulo';
const TERMO_1 = 'cfg-modelo-termo-USO_DE_IMAGEM-titulo';
const DOCUMENTO_0 = 'cfg-modelo-docs-doc-0-titulo';
const DOCUMENTO_1 = 'cfg-modelo-docs-doc-1-titulo';
const DOCUMENTOS = 'cfg-modelo-docs-titulo';

const recusa = (ponteiro: string, message: string, code = TEXTO_NAO_GRAVAVEL): ErroDeCampo => ({
  field: `conteudo.${ponteiro}`,
  code,
  message,
});

/** Os blocos da tela que mostram a mensagem em uma lista de recusas, pelo título que os nomeia. */
function blocosQueMostram(tela: HTMLElement, mensagem: string): string[] {
  return Array.from(tela.querySelectorAll('.editor-formulario__erros'))
    .filter((lista) => lista.textContent?.includes(mensagem))
    .map((lista) => lista.closest('[aria-labelledby]')?.getAttribute('aria-labelledby') ?? '');
}

describe('ModeloFormularioEdicaoPage: recusas pelos ponteiros do contrato', () => {
  let fixture: ComponentFixture<ModeloFormularioEdicaoPage>;
  let controller: HttpTestingController;

  beforeEach(() => {
    ({ fixture, controller } = montarTelaDeEdicao());
  });

  afterEach(() => controller.verify());

  async function aoRecusarGravacao(...erros: ErroDeCampo[]): Promise<HTMLElement> {
    responderCarga(controller, {
      modelo: modeloDoContrato,
      fatosExtras: [fato('PARENTESCO'), fato('OCUPACAO')],
    });
    const tela = await propagarAlteracoes(fixture);
    salvar(tela);
    recusarGravacao(controller, erros);
    return propagarAlteracoes(fixture);
  }

  // Os dados básicos não viajam no envio: o índice 0 de `itens` é o primeiro campo depois deles.
  it('leva a recusa de `itens[0].precondicao` ao campo enviado, e a nenhum vizinho', async () => {
    const tela = await aoRecusarGravacao(
      recusa('itens[0].precondicao', 'A exibição do campo não pode ser gravada.'),
    );

    expect(blocosQueMostram(tela, 'A exibição do campo')).toEqual([ITEM_0]);
    expect(tela.querySelector('.cfg-modelo-resumo')?.textContent).not.toContain(
      'A exibição do campo',
    );
  });

  it('leva a recusa de `itens[0].predicadoObrigatoriedade` ao campo enviado, e a nenhum vizinho', async () => {
    const tela = await aoRecusarGravacao(
      recusa(
        'itens[0].predicadoObrigatoriedade',
        'A condição de obrigatoriedade do campo não pode ser gravada.',
      ),
    );

    expect(blocosQueMostram(tela, 'condição de obrigatoriedade do campo')).toEqual([ITEM_0]);
  });

  it('leva a recusa de `grupos[0].predicadoObrigatoriedade` ao grupo, e não aos campos dele nem ao outro grupo', async () => {
    const tela = await aoRecusarGravacao(
      recusa(
        'grupos[0].predicadoObrigatoriedade',
        'A condição de obrigatoriedade do grupo não pode ser gravada.',
      ),
    );

    expect(blocosQueMostram(tela, 'condição de obrigatoriedade do grupo')).toEqual([GRUPO_0]);
  });

  it('leva a recusa de `grupos[0].subitens[0].precondicao` ao campo do grupo, e não ao grupo nem ao outro campo', async () => {
    const tela = await aoRecusarGravacao(
      recusa(
        'grupos[0].subitens[0].precondicao',
        'A exibição do campo do grupo não pode ser gravada.',
      ),
    );

    expect(blocosQueMostram(tela, 'exibição do campo do grupo')).toEqual([SUBITEM_0]);
  });

  it('leva a recusa de `termos[0].predicadoObrigatoriedade` ao termo, e não ao outro termo', async () => {
    const tela = await aoRecusarGravacao(
      recusa(
        'termos[0].predicadoObrigatoriedade',
        'A condição de aceite do termo não pode ser gravada.',
      ),
    );

    expect(blocosQueMostram(tela, 'condição de aceite do termo')).toEqual([TERMO_0]);
  });

  it('leva a recusa de obrigatoriedade inválida, em `itens[0].obrigatoriedade`, ao campo enviado', async () => {
    const tela = await aoRecusarGravacao(
      recusa(
        'itens[0].obrigatoriedade',
        'A obrigatoriedade do campo não é reconhecida.',
        OBRIGATORIEDADE_INVALIDA,
      ),
    );

    expect(blocosQueMostram(tela, 'obrigatoriedade do campo não é reconhecida')).toEqual([ITEM_0]);
  });

  it('leva cada recusa de índice 1 à segunda entrada enviada do mesmo tipo', async () => {
    const tela = await aoRecusarGravacao(
      recusa('itens[1].precondicao', 'Exibição do segundo campo.'),
      recusa('grupos[1].predicadoObrigatoriedade', 'Obrigatoriedade do segundo grupo.'),
      recusa('grupos[0].subitens[1].precondicao', 'Exibição do segundo campo do grupo.'),
      recusa('termos[1].predicadoObrigatoriedade', 'Aceite do segundo termo.'),
    );

    expect(blocosQueMostram(tela, 'segundo campo.')).toEqual([ITEM_1]);
    expect(blocosQueMostram(tela, 'segundo grupo')).toEqual([GRUPO_1]);
    expect(blocosQueMostram(tela, 'segundo campo do grupo')).toEqual([SUBITEM_1]);
    expect(blocosQueMostram(tela, 'segundo termo')).toEqual([TERMO_1]);
  });

  it('leva a recusa de `documentosExigidos[1].quando` ao segundo documento enviado, mesmo com falha no primeiro', async () => {
    const tela = await aoRecusarGravacao(
      recusa('documentosExigidos[0].faseCodigo', 'A fase do documento não foi reconhecida.'),
      recusa(
        'documentosExigidos[1].quando',
        'A condição do documento cita fato que o modelo não coleta.',
      ),
    );

    expect(blocosQueMostram(tela, 'fase do documento não foi reconhecida')).toEqual([DOCUMENTO_0]);
    expect(blocosQueMostram(tela, 'condição do documento cita fato')).toEqual([DOCUMENTO_1]);
  });

  it('leva a recusa de sufixo desconhecido ao próprio campo, grupo ou termo apontado', async () => {
    const tela = await aoRecusarGravacao(
      recusa('itens[0].campoDesconhecido', 'Falha no campo.'),
      recusa('grupos[0].campoDesconhecido', 'Falha no grupo.'),
      recusa('termos[0].campoDesconhecido', 'Falha no termo.'),
    );

    expect(blocosQueMostram(tela, 'Falha no campo.')).toEqual([ITEM_0]);
    expect(blocosQueMostram(tela, 'Falha no grupo.')).toEqual([GRUPO_0]);
    expect(blocosQueMostram(tela, 'Falha no termo.')).toEqual([TERMO_0]);
  });

  it('leva ao resumo geral a recusa de lista sem índice, e à lista de documentos a dos documentos', async () => {
    const tela = await aoRecusarGravacao(
      recusa('itens', 'A lista de campos está inválida.'),
      recusa('termos.predicadoObrigatoriedade', 'A lista de termos está inválida.'),
      recusa('documentosExigidos', 'A lista de documentos está inválida.'),
    );

    const resumo = tela.querySelector('.cfg-modelo-resumo')?.textContent;
    expect(resumo).toContain('A lista de campos está inválida.');
    expect(resumo).toContain('A lista de termos está inválida.');
    expect(blocosQueMostram(tela, 'A lista de campos')).toEqual([]);
    expect(blocosQueMostram(tela, 'A lista de documentos')).toEqual([DOCUMENTOS]);
  });
});
