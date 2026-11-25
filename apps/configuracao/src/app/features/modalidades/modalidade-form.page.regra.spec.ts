import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { BONUS, LB_PPI, PaginaDaModalidade } from './modalidade-form.page.testing';
import { URL, URL_ADMIN, URL_CATALOGO, modalidade } from './modalidades-de-teste.testing';

describe('ModalidadeFormPage', () => {
  let pagina: PaginaDaModalidade;

  beforeEach(() => {
    pagina = new PaginaDaModalidade();
  });

  afterEach(() => {
    pagina.verificar();
  });

  describe('regra de aplicabilidade', () => {
    it('lê a regra salva em prosa, pelos nomes do catálogo, sem códigos', async () => {
      await pagina.editar(BONUS);

      const texto = pagina.textoDaRegra();
      expect(texto).toContain('Quem atende a pelo menos uma destas alternativas:');
      expect(texto).toContain('Cursou o ensino médio em escola pública é sim');
      expect(texto).toContain('Cor/raça é Indígena');
      expect(texto).not.toContain('"INDIGENA"');
    });

    it('sem o catálogo, a nova tentativa que dá certo leva o foco à seção da regra', async () => {
      pagina.usarRota(BONUS.id);
      await pagina.montar();
      pagina.controller.expectOne(`${URL}/${BONUS.id}`).flush(BONUS);
      TestBed.tick();
      pagina.controller
        .expectOne(URL_CATALOGO)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      pagina.fixture.detectChanges();
      const tentar = (): HTMLButtonElement =>
        pagina.fixture.nativeElement.querySelector(
          'section[aria-labelledby="cfg-mod-regra"] button',
        );

      tentar().focus();
      tentar().click();
      pagina.fixture.detectChanges();
      TestBed.tick();

      pagina.controller.expectOne(URL_CATALOGO).flush([...CATALOGO]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      pagina.fixture.detectChanges();
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(pagina.textoDaRegra()).not.toContain('Catálogo de fatos não carregado');
      expect(document.activeElement).toBe(
        pagina.fixture.nativeElement.querySelector('#cfg-mod-regra'),
      );
    });

    it('lê a regra sem condição como todos os candidatos', async () => {
      await pagina.editar(modalidade({ ...BONUS, regraDeAplicabilidade: [] }));

      expect(pagina.textoDaRegra()).toContain('Todos os candidatos.');
    });

    it('mostra a regra da modalidade legal fixa só para leitura e a reenvia como veio', async () => {
      await pagina.editar(LB_PPI);

      expect(pagina.fixture.nativeElement.querySelector('insc-editor-de-condicoes')).toBeNull();
      expect(pagina.textoDaRegra()).toContain(
        'Quem atende: Cor/raça é um de Preta, Parda, Indígena.',
      );

      pagina.edicao.salvar();
      const put = pagina.controller.expectOne(`${URL_ADMIN}/${LB_PPI.id}`);
      expect(put.request.body.regraDeAplicabilidade).toEqual(LB_PPI.regraDeAplicabilidade);
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('edita a regra da modalidade institucional e envia o que o editor escreveu', async () => {
      await pagina.editar(BONUS);
      expect(pagina.fixture.nativeElement.querySelector('insc-editor-de-condicoes')).not.toBeNull();

      pagina.edicao.aplicabilidade.trocar([
        { clausula: 1, fato: 'COR_RACA', operador: 'NENHUM_DE', valor: '["PRETA"]' },
      ]);
      pagina.edicao.salvar();

      const put = pagina.controller.expectOne(`${URL_ADMIN}/${BONUS.id}`);
      expect(put.request.body.regraDeAplicabilidade).toEqual([
        [{ fato: 'COR_RACA', operador: 'NENHUM_DE', valor: ['PRETA'] }],
      ]);
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('envia a regra sem condição como lista vazia, nunca ausente', async () => {
      await pagina.editar(BONUS);

      pagina.edicao.aplicabilidade.trocar([]);
      pagina.edicao.salvar();

      const put = pagina.controller.expectOne(`${URL_ADMIN}/${BONUS.id}`);
      expect(put.request.body.regraDeAplicabilidade).toEqual([]);
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('não oferece ao editor o fato da própria modalidade', async () => {
      await pagina.editar(BONUS);

      expect(pagina.edicao.aplicabilidade.fatos().map((fato) => fato.codigo)).toEqual([
        'ESCOLA_PUBLICA',
        'COR_RACA',
      ]);
    });

    it('recusa enviar a condição sem valor e aponta a condição', async () => {
      await pagina.editar(BONUS);

      pagina.edicao.aplicabilidade.trocar([
        { clausula: 1, fato: 'COR_RACA', operador: 'IGUAL', valor: '' },
      ]);
      pagina.edicao.salvar();

      pagina.controller.expectNone(`${URL_ADMIN}/${BONUS.id}`);
      expect(pagina.edicao.aplicabilidade.errosDasCondicoes()).toEqual({
        0: '"Cor/raça" está sem valor',
      });
    });

    it('mostra no campo da regra a recusa da API à regra', async () => {
      await pagina.editar(BONUS);

      pagina.edicao.salvar();
      pagina.controller.expectOne(`${URL_ADMIN}/${BONUS.id}`).flush(
        {
          type: 'https://uniplus.unifesspa.edu.br/errors/validacao',
          title: 'Erro de validação',
          status: 422,
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'regraDeAplicabilidade',
              code: 'uniplus.configuracao.modalidade.regra_cita_fato_desativado',
              message: "O fato 'ESCOLA_PUBLICA' está desativado e não aceita citação nova.",
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      pagina.fixture.detectChanges();

      const erro = pagina.fixture.nativeElement.querySelector(
        'section[aria-labelledby="cfg-mod-regra"] [role="alert"]',
      ) as HTMLElement | null;
      expect(erro?.tagName).toBe('DIV');
      const itens = erro?.querySelectorAll(
        'ul[aria-label="Erros da regra de aplicabilidade"] > li',
      );
      expect(Array.from(itens ?? [], (item) => item.textContent?.trim())).toEqual([
        "O fato 'ESCOLA_PUBLICA' está desativado e não aceita citação nova.",
      ]);
      expect(pagina.edicao.erro()).toBeNull();
    });
  });
});
