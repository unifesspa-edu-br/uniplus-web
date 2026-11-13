import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import type {
  DetalheDaProtecaoDoCatalogoDto,
  ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDaProtecaoDoCatalogo } from './edicao-da-protecao-do-catalogo';
import { ProtecaoDoCatalogoPage } from './protecao-do-catalogo.page';
import {
  APROVAR,
  URL_DA_FILA as URL,
  abrirItem,
  botaoDoRodape,
  campoDaJustificativa,
  clicar,
  confirmarNoDialogo as confirmar,
  detalheDoFato,
  detalheDoLaudo,
  dialogoDaDecisao as dialogo,
  digitar as digitarNoCampo,
  laudo,
  montarPagina,
  problema as recusa,
  rural,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

describe('ProtecaoDoCatalogoPage — recomendar ajuste e reprovar', () => {
  const concedidas = signal<readonly string[]>([APROVAR]);
  let pagina: PaginaMontada;
  let fixture: ComponentFixture<ProtecaoDoCatalogoPage>;
  let controller: HttpTestingController;
  let assentar: () => Promise<void>;

  beforeEach(() => {
    concedidas.set([APROVAR]);
    pagina = montarPagina(concedidas);
    ({ fixture, controller, assentar } = pagina);
  });

  afterEach(() => pagina.encerrar());

  async function carregar(itens: readonly ItemDaProtecaoDoCatalogoDto[]): Promise<HTMLElement> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao'), 'só o que aguarda a decisão').toBe('SOLICITADA');
    req.flush(itens);
    await assentar();
    return fixture.nativeElement as HTMLElement;
  }

  const abrir = (
    _tela: HTMLElement,
    item: ItemDaProtecaoDoCatalogoDto,
    detalhe: DetalheDaProtecaoDoCatalogoDto,
  ): Promise<void> => abrirItem(pagina, item, detalhe);
  const digitar = (campo: HTMLTextAreaElement, texto: string): void => {
    digitarNoCampo(campo, texto);
    fixture.detectChanges();
  };

  describe('recomendar ajuste', () => {
    const abrirDialogo = async (item = laudo, detalhe = detalheDoLaudo): Promise<HTMLElement> => {
      const tela = await carregar([item]);
      await abrir(tela, item, detalhe);
      clicar(botaoDoRodape(tela, 'Recomendar ajuste'));
      fixture.detectChanges();
      return tela;
    };

    it('sem a classificação recomendada não envia, pede a classificação e leva o foco ao seletor', async () => {
      const tela = await abrirDialogo();
      await assentar();

      clicar(confirmar(tela, 'Recomendar ajuste'));
      fixture.detectChanges();
      await assentar();

      controller.expectNone((r) => r.method === 'POST');
      expect(tela.querySelector('#cfg-ajuste-erro')?.textContent).toContain(
        'Indique a classificação recomendada.',
      );
      const campo = dialogo(tela)?.querySelector('select');
      expect(document.activeElement, 'o foco vai ao seletor').toBe(campo);
      expect(campo?.getAttribute('aria-describedby')).toContain('cfg-ajuste-erro');
    });

    it('oferece só a classificação que a hipótese legal e o tipo do dado admitem, sem a atual', async () => {
      const tela = await abrirDialogo();

      const opcoes = Array.from(
        dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? [],
      ).map((o) => o.value);
      expect(opcoes).toContain('SENSIVEL');
      expect(opcoes).not.toContain('INTERNO');
    });

    it('no fato de texto não oferece classificação abaixo de pessoal, que a API também recusa', async () => {
      const tela = await abrirDialogo(
        rural,
        detalheDoFato({
          classificacaoProtecao: 'SENSIVEL',
          fato: {
            dominio: 'TEXTO',
            cardinalidade: 'ESCALAR',
            sistema: false,
            componenteExibicao: null,
            valores: [],
          },
        }),
      );

      const opcoes = Array.from(
        dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? [],
      ).map((o) => o.value);
      expect(opcoes).toContain('PESSOAL');
      expect(opcoes).not.toContain('PUBLICO');
      expect(opcoes).not.toContain('INTERNO');
    });

    it('não oferece a classificação que a hipótese legal declarada não admite', async () => {
      const tela = await abrirDialogo(laudo, {
        ...detalheDoLaudo,
        classificacaoProtecao: 'PESSOAL',
        hipoteseLegal: 'INTERESSE_LEGITIMO',
      });

      const opcoes = Array.from(
        dialogo(tela)?.querySelectorAll<HTMLOptionElement>('select option') ?? [],
      ).map((o) => o.value);
      expect(
        opcoes,
        'interesse legítimo é só do art. 7º: o dado sensível não o admite',
      ).not.toContain('SENSIVEL');
      expect(opcoes).toContain('INTERNO');
    });

    it('envia a classificação recomendada com a justificativa aparada, que é opcional', async () => {
      const tela = await abrirDialogo();
      fixture.debugElement.injector
        .get(EdicaoDaProtecaoDoCatalogo)
        .recomendada.setValue('SENSIVEL');
      digitar(campoDaJustificativa(tela), '  O laudo traz dado de saúde.  ');

      clicar(confirmar(tela, 'Recomendar ajuste'));

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body).toMatchObject({
        decisao: 'RECOMENDAR_AJUSTE',
        classificacaoRecomendada: 'SENSIVEL',
        classificacaoProtecao: 'INTERNO',
        justificativa: 'O laudo traz dado de saúde.',
      });
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('sem justificativa envia o ajuste com a justificativa nula', async () => {
      const tela = await abrirDialogo();
      fixture.debugElement.injector
        .get(EdicaoDaProtecaoDoCatalogo)
        .recomendada.setValue('SENSIVEL');
      digitar(campoDaJustificativa(tela), '   ');

      clicar(confirmar(tela, 'Recomendar ajuste'));

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body.justificativa).toBeNull();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('a recusa da API fica no diálogo, com a mensagem, e a lista não é relida', async () => {
      const tela = await abrirDialogo();
      fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).recomendada.setValue('PUBLICO');
      clicar(confirmar(tela, 'Recomendar ajuste'));

      controller
        .expectOne((r) => r.method === 'POST' && r.url === URL)
        .flush(
          ...recusa(
            422,
            'uniplus.configuracao.protecao_do_catalogo.recomendacao_incompativel_com_a_hipotese_legal',
            'A base legal do item não cabe na classificação recomendada',
          ),
        );
      await assentar();

      expect(fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).decisaoAberta()).toBe(
        true,
      );
      expect(
        fixture.debugElement.injector.get(EdicaoDaProtecaoDoCatalogo).erroDaDecisaoNoDialogo(),
      ).toBe('A base legal do item não cabe na classificação recomendada');
    });
  });

  describe('reprovar', () => {
    const abrirDialogo = async (): Promise<HTMLElement> => {
      const tela = await carregar([laudo]);
      await abrir(tela, laudo, detalheDoLaudo);
      clicar(botaoDoRodape(tela, 'Reprovar'));
      fixture.detectChanges();
      return tela;
    };

    it('mantém a decisão em andamento acessível e impede uma segunda gravação', async () => {
      const tela = await abrirDialogo();
      const campo = campoDaJustificativa(tela);
      digitar(campo, 'Falta a base legal.');
      const botao = confirmar(tela, 'Reprovar item') as HTMLButtonElement;
      botao.focus();
      botao.click();
      fixture.detectChanges();
      const requisicao = controller.expectOne((r) => r.url === URL && r.method === 'POST');

      expect(campo.matches(':disabled')).toBe(true);
      expect(campo.value).toBe('Falta a base legal.');
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(botao);
      expect(dialogo(tela)?.querySelector('[role="status"]')?.textContent).toContain(
        'Registrando decisão',
      );
      botao.click();
      controller.expectNone((r) => r.url === URL && r.method === 'POST');
      requisicao.flush(null);
      await assentar();
      controller.expectOne((r) => r.url === URL && r.method === 'GET').flush([]);
      await assentar();
    });

    it('exige a justificativa: em branco não envia, o erro fica associado ao campo e o foco vai a ele', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), '   ');

      clicar(confirmar(tela, 'Reprovar item'));
      fixture.detectChanges();
      await assentar();

      controller.expectNone((r) => r.method === 'POST');
      const campo = campoDaJustificativa(tela);
      expect(tela.querySelector('#cfg-justificativa-erro')?.textContent).toContain(
        'Informe a justificativa da reprovação.',
      );
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.getAttribute('aria-describedby')).toContain('cfg-justificativa-erro');
      expect(campo.getAttribute('aria-required')).toBe('true');
      expect(document.activeElement).toBe(campo);
    });

    it('o campo limita a 2.000 caracteres e o contador diz "N de 2.000"', async () => {
      const tela = await abrirDialogo();

      expect(campoDaJustificativa(tela).getAttribute('maxlength')).toBe('2000');
      expect(tela.querySelector('#cfg-justificativa-contador')?.textContent?.trim()).toBe(
        '0 de 2.000',
      );
      digitar(campoDaJustificativa(tela), 'Falta a base legal.');
      expect(tela.querySelector('#cfg-justificativa-contador')?.textContent?.trim()).toBe(
        '19 de 2.000',
      );
    });

    it('acima de 2.000 caracteres não envia e informa o limite no campo', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), 'a'.repeat(2001));

      clicar(confirmar(tela, 'Reprovar item'));
      fixture.detectChanges();

      controller.expectNone((r) => r.method === 'POST');
      expect(tela.querySelector('#cfg-justificativa-erro')?.textContent).toContain(
        'A justificativa aceita até 2.000 caracteres.',
      );
    });

    it('envia a justificativa aparada, sem classificação recomendada', async () => {
      const tela = await abrirDialogo();
      digitar(campoDaJustificativa(tela), '  Falta a base legal.  ');

      clicar(confirmar(tela, 'Reprovar item'));

      const post = controller.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(post.request.body).toMatchObject({
        decisao: 'REPROVAR',
        justificativa: 'Falta a base legal.',
      });
      expect(post.request.body.classificacaoRecomendada).toBeUndefined();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    });

    it('o diálogo não repete o código técnico do item', async () => {
      const tela = await abrirDialogo();

      const texto = dialogo(tela)?.textContent ?? '';
      expect(texto).toContain('Laudo médico complementar');
      expect(texto).not.toContain('LAUDO_MEDICO_COMPLEMENTAR');
    });
  });
});
