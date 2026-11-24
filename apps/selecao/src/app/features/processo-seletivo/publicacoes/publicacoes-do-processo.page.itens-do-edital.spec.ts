import { By } from '@angular/platform-browser';
import {
  SituacaoDoProdutoPrevistoCodigo,
  StatusProcessoCodigo,
  ImpedimentoDoProdutoCodigo,
  type ProdutoPrevistoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PublicarDocumentoComponent } from './publicar-documento.component';
import {
  PaginaDePublicacoes,
  ROTA_ATOS,
  ato,
  item,
  previstos,
  botao,
  temCorrigir,
} from './publicacoes-do-processo.page.testing';

const DEFINITIVO = {
  codigo: 'DEFINITIVO' as NonNullable<ProdutoPrevistoDto['papel']>['codigo'],
  rotulo: 'Definitivo',
};
const PUBLICADO = { codigo: SituacaoDoProdutoPrevistoCodigo.PUBLICADO, rotulo: 'Publicado' };

describe('PublicacoesDoProcessoPage — itens do edital', () => {
  let pagina: PaginaDePublicacoes;

  beforeEach(() => {
    pagina = new PaginaDePublicacoes();
  });

  afterEach(() => pagina.controller.verify());

  it('lista os itens do edital por fase e libera "Publicar" só no que o servidor libera', async () => {
    const preliminar = item('preliminar');
    const definitivo = item('definitivo', {
      papel: DEFINITIVO,
      podePublicar: false,
      impedimento: {
        motivo: {
          codigo: ImpedimentoDoProdutoCodigo.PRELIMINAR_NAO_PUBLICADO,
          rotulo: 'Preliminar não publicado',
        },
        mensagem:
          'O resultado definitivo só pode ser publicado depois do preliminar da mesma matéria.',
      },
    });

    await pagina.abrir(StatusProcessoCodigo.PUBLICADO, [], previstos(preliminar, definitivo));

    expect(pagina.host.querySelector('sel-previstos-no-edital h3')?.textContent).toContain(
      'Inscrição',
    );
    const [linhaDoPreliminar, linhaDoDefinitivo] = pagina.linhasDosPrevistos();
    expect(botao(linhaDoPreliminar, 'Publicar')).toBeDefined();
    expect(botao(linhaDoDefinitivo, 'Publicar')).toBeUndefined();
    expect(linhaDoDefinitivo.textContent).toContain('só pode ser publicado depois do preliminar');
  });

  it('abre o formulário do resultado com a política do certame pelos nomes dos campos', async () => {
    await pagina.abrir(StatusProcessoCodigo.PUBLICADO, [], previstos(item('preliminar')));

    botao(pagina.linhasDosPrevistos()[0], 'Publicar')?.click();
    pagina.fixture.detectChanges();

    expect(pagina.fixture.componentInstance['modo']()).toMatchObject({
      tipo: 'previsto',
      item: { id: 'preliminar' },
      politica: { campos: ['Número de inscrição'], justificativa: null },
      corrigido: null,
    });
    expect(pagina.fixture.componentInstance['formularioAberto']()).toBe(true);
  });

  it('sem o catálogo de campos, publica do mesmo jeito e mostra a política pelo código', async () => {
    await pagina.abrir(StatusProcessoCodigo.PUBLICADO, [], previstos(item('preliminar')), true);

    botao(pagina.linhasDosPrevistos()[0], 'Publicar')?.click();
    pagina.fixture.detectChanges();

    expect(pagina.fixture.componentInstance['modo']()).toMatchObject({
      tipo: 'previsto',
      politica: { campos: ['numero_inscricao'] },
    });
  });

  it('abre a correção do item apontando a correção mais recente da cadeia', async () => {
    const original = ato('original');
    const errata = ato('errata', { atoCorrigidoId: 'original' });
    const publicado = item('preliminar', {
      situacao: PUBLICADO,
      ato: original,
      correcoes: [errata],
      podePublicar: false,
    });

    await pagina.abrir(StatusProcessoCodigo.PUBLICADO, [errata, original], previstos(publicado));

    botao(pagina.linhasDosPrevistos()[0], 'Corrigir')?.click();
    pagina.fixture.detectChanges();

    expect(pagina.fixture.componentInstance['modo']()).toMatchObject({
      tipo: 'previsto',
      corrigido: { id: 'errata' },
    });
  });

  it('não oferece, na lista de documentos, a correção do ato de um item do edital', async () => {
    const doItem = ato('resultado');

    await pagina.abrir(
      StatusProcessoCodigo.PUBLICADO,
      [doItem],
      previstos(
        item('preliminar', {
          situacao: PUBLICADO,
          ato: doItem,
          podePublicar: false,
        }),
      ),
    );

    expect(temCorrigir(pagina.linhas()[0])).toBe(false);
  });

  it('relê os itens quando o documento é publicado e libera o definitivo', async () => {
    const definitivoBloqueado = item('definitivo', {
      papel: DEFINITIVO,
      podePublicar: false,
      impedimento: {
        motivo: {
          codigo: ImpedimentoDoProdutoCodigo.PRELIMINAR_NAO_PUBLICADO,
          rotulo: 'Preliminar não publicado',
        },
        mensagem: 'O resultado preliminar ainda não foi publicado.',
      },
    });
    await pagina.abrir(
      StatusProcessoCodigo.PUBLICADO,
      [],
      previstos(item('preliminar'), definitivoBloqueado),
    );
    expect(botao(pagina.linhasDosPrevistos()[1], 'Publicar')).toBeUndefined();

    const formulario = pagina.fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    (formulario.componentInstance as PublicarDocumentoComponent).publicado.emit();

    pagina.controller.expectOne(ROTA_ATOS).flush([]);
    pagina.responderPrevistos(
      previstos(
        item('preliminar', {
          situacao: PUBLICADO,
          ato: ato('original'),
          podePublicar: false,
        }),
        item('definitivo', { papel: DEFINITIVO }),
      ),
    );
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    const [linhaDoPreliminar, linhaDoDefinitivo] = pagina.linhasDosPrevistos();
    expect(linhaDoPreliminar.textContent).toContain('Publicado em');
    expect(botao(linhaDoDefinitivo, 'Publicar')).toBeDefined();
  });
});
