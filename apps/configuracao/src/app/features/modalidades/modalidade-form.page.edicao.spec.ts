import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BONUS, PaginaDaModalidade } from './modalidade-form.page.testing';
import { URL, URL_ADMIN, modalidade } from './modalidades-de-teste.testing';

describe('ModalidadeFormPage', () => {
  let pagina: PaginaDaModalidade;

  beforeEach(() => {
    pagina = new PaginaDaModalidade();
  });

  afterEach(() => {
    pagina.verificar();
  });

  describe('edição', () => {
    it('mantém o que foi digitado ao trocar a natureza ou a composição', async () => {
      await pagina.editar(
        modalidade({ ...BONUS, regraRemanejamento: null, remanejamentoDestino: null }),
      );
      pagina.edicao.form.controls.descricao.setValue('Descrição digitada');

      pagina.setControl('composicaoVagas', 'RETIRADA_DE_OUTRA_MODALIDADE');
      pagina.edicao.aoMudarComposicao();
      TestBed.tick();
      pagina.setControl('naturezaLegal', 'COTA_RESERVADA');
      pagina.edicao.aoMudarNatureza();
      TestBed.tick();

      expect(pagina.edicao.form.controls.descricao.value).toBe('Descrição digitada');
      expect(pagina.edicao.form.controls.composicaoVagas.value).toBe(
        'RETIRADA_DE_OUTRA_MODALIDADE',
      );
      expect(pagina.edicao.form.controls.naturezaLegal.value).toBe('COTA_RESERVADA');
      expect(pagina.edicao.natureza()).toBe('COTA_RESERVADA');
      expect(pagina.edicao.mostraOrigem()).toBe(true);
    });

    it('mantém a chave e mostra o título quando a gravação original ainda está em processamento (409)', async () => {
      await pagina.editar(BONUS);
      const enviar = (): TestRequest => {
        pagina.edicao.salvar();
        return pagina.controller.expectOne(`${URL_ADMIN}/${BONUS.id}`);
      };
      const primeira = enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Requisição em processamento',
          status: 409,
          code: 'uniplus.idempotency.processing_conflict',
        }),
        {
          status: 409,
          statusText: 'Conflict',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(pagina.edicao.erro()).toBe('Requisição em processamento');
      const segunda = enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  describe('código na edição', () => {
    it('não normaliza nem altera o código, que é somente leitura', async () => {
      await pagina.editar(BONUS);
      const campo = pagina.fixture.nativeElement.querySelector(
        'input[formcontrolname="codigo"]',
      ) as HTMLInputElement;
      campo.dispatchEvent(new Event('input'));
      expect(campo.readOnly || campo.disabled).toBe(true);
      expect(pagina.edicao.form.controls.codigo.value).toBe('AA_REGIONAL');
    });
  });

  describe('leitura da modalidade em edição', () => {
    const problema = (status: number, title: string) =>
      [
        { type: 'about:blank', title, status, code: 'erro' },
        { status, statusText: title },
      ] as const;
    const titulo = (): HTMLElement =>
      pagina.fixture.nativeElement.querySelector('#cfg-modalidade-form-titulo');
    const formulario = (): HTMLElement | null =>
      pagina.fixture.nativeElement.querySelector('cfg-modalidade-formulario');
    const tentar = (): HTMLButtonElement | null =>
      pagina.fixture.nativeElement.querySelector('ui-falha-de-leitura button');

    it('a falha da leitura esconde o formulário em branco, e a nova tentativa o preenche e leva o foco ao título', async () => {
      pagina.usarRota(BONUS.id);
      await pagina.montar();
      pagina.controller
        .expectOne(`${URL}/${BONUS.id}`)
        .flush(...problema(503, 'Serviço indisponível'));
      await pagina.atualizar();

      expect(formulario()).toBeNull();
      expect(pagina.fixture.nativeElement.textContent).toContain(
        'Não foi possível carregar a modalidade',
      );
      tentar()?.focus();
      tentar()?.click();
      pagina.fixture.detectChanges();
      TestBed.tick();
      pagina.controller.expectOne(`${URL}/${BONUS.id}`).flush(BONUS);
      await pagina.atualizar();
      await pagina.atualizar();

      expect(formulario()).not.toBeNull();
      expect(pagina.edicao.form.controls.codigo.value).toBe(BONUS.codigo);
      expect(document.activeElement).toBe(titulo());
    });

    it('a modalidade inexistente não oferece nova tentativa nem formulário e manda voltar à lista', async () => {
      pagina.usarRota(BONUS.id);
      await pagina.montar();
      pagina.controller
        .expectOne(`${URL}/${BONUS.id}`)
        .flush(...problema(404, 'Modalidade não encontrada'));
      await pagina.atualizar();

      expect(tentar()).toBeNull();
      expect(formulario()).toBeNull();
      expect(pagina.fixture.nativeElement.textContent).toContain(
        'Não foi possível abrir a modalidade',
      );
      expect(pagina.fixture.nativeElement.textContent).toContain('Volte à lista');
    });
  });
});
