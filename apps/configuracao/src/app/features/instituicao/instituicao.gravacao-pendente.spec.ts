import { InstituicaoFormularioComponent } from './instituicao-formulario.component';
import {
  ESCRITA,
  ID,
  montarPagina,
  Pagina,
  problema,
  recusaDeCampo,
  sucesso,
  unifesspa,
} from './instituicao.testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('InstituicaoPage — escritas pela interface', () => {
  let p: Pagina;

  afterEach(() => p.http.verify());

  describe('gravação pendente', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirFormulario();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      const botao = p.salvar();

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(p.campo('nome').value).toBe(unifesspa.nome);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(document.activeElement).toBe(botao);
      expect(p.drawer().querySelector('[role="status"]')?.textContent).toContain('Salvando');
      expect(
        p.drawer().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      expect(p.cancelarDoFormulario().matches(':disabled')).toBe(true);
      p.drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);

      put.flush(...sucesso());
      await p.responderLeitura(unifesspa);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      await p.abrirFormulario();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      p.submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      p.http.expectNone((r) => r.method === 'PUT');
      put.flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirFormulario();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(InstituicaoFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      expect(pedidos).toEqual(['salvar']);

      p.submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      put.flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('durante a releitura que segue uma recusa, salvar fica indisponível e não apaga o alerta', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();
      const alerta = (): Element | null =>
        p.fixture.nativeElement.querySelector('ui-drawer ui-alert');
      expect(p.edicao.gravando()).toBe(true);
      expect(alerta()).not.toBeNull();
      expect(p.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(p.salvar().textContent).not.toContain('Salvando...');

      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      p.submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      expect(alerta()).not.toBeNull();
      p.http.expectNone((r) => r.method === 'PUT');
      await p.responderLeitura(null);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirFormulario();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);

      put.flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.removendo()).toBe(false);
      await p.responderLeitura(unifesspa);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await p.abrirFormulario();
      p.campo('nome').focus();
      p.submeter();
      await p.propagar();
      const put = p.http.expectOne((r) => r.url === `${ESCRITA}/${ID}` && r.method === 'PUT');

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      put.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('nome').matches(':disabled')).toBe(false);
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Falha');
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      p.submeter();
      p.http
        .expectOne((r) => r.url === `${ESCRITA}/${ID}` && r.method === 'PUT')
        .flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('a recusa de campo devolve o foco ao campo recusado', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();
      await p.propagar();

      expect(p.campo('cnpj').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.campo('cnpj'));
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      await p.abrirFormulario();
      p.edicao.form.controls.mantenedora.disable();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      expect(p.edicao.form.controls.mantenedora.disabled).toBe(true);

      if (desfecho === 'sucesso') put.flush(...sucesso());
      else put.flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();

      expect(p.edicao.form.controls.mantenedora.disabled).toBe(true);
      expect(p.edicao.form.controls.nome.enabled).toBe(true);
      expect(p.campo('mantenedora').matches(':disabled')).toBe(true);
      if (desfecho === 'sucesso') await p.responderLeitura(unifesspa);
    });
  });
});
