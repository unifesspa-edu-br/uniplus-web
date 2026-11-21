import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  TITULO_DA_LISTA,
  corpoDaFalha,
  decreto,
  montarPagina,
  portaria,
  problema,
  sucesso,
} from './base-legal-bonus-regional.testing';

const NAO_ENCONTRADA = {
  code: 'uniplus.configuracao.base_legal_bonus_regional.nao_encontrado',
  title: 'Base legal de bônus regional não encontrada',
};

describe('BaseLegalBonusRegionalPage — remoção e foco depois da escrita', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([portaria, decreto]);
  });
  afterEach(() => p.http.verify());

  describe('ao remover', () => {
    const lerMensagem = (): string | undefined =>
      p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();

    it('recusa 404 mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
      (await p.confirmarRemocao(portaria)).flush(...problema(404, NAO_ENCONTRADA));
      await p.propagar();

      expect(lerMensagem()).toBe(NAO_ENCONTRADA.title);
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível remover a base legal Portaria Unifesspa nº 2514/2023.',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${portaria.id}`).flush(...sucesso());
      await p.recarregarCom([decreto]);
      expect(p.edicao.confirmando()).toBe(false);
    });

    it('falta de permissão mantém o diálogo com a mensagem, sem toast', async () => {
      (await p.confirmarRemocao(portaria)).flush(...problema(403, corpoDaFalha(403)));
      await p.propagar();

      expect(lerMensagem()).toBe('Falha');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
      (await p.confirmarRemocao(portaria)).flush(...problema(500, corpoDaFalha(500)));
      await p.propagar();

      expect(lerMensagem()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(portaria));
    });

    it('pede a confirmação antes de qualquer requisição e a nomeia pela base', async () => {
      p.remover(portaria).focus();
      p.remover(portaria).click();
      await p.propagar();

      p.http.expectNone(`${ESCRITA}/${portaria.id}`);
      expect(p.elemento('cfg-confirmacao-de-remocao').textContent).toContain('Remover base legal');
      expect(p.elemento('cfg-confirmacao-de-remocao').textContent).toContain(
        'Tem certeza que deseja remover "Portaria Unifesspa nº 2514/2023"? Processos que já a referenciam mantêm a cópia congelada.',
      );
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao(portaria);
      (await p.enviar(`${ESCRITA}/${portaria.id}`)).flush(...sucesso());
      await p.recarregarCom([portaria, decreto]);
      expect(document.activeElement).toBe(p.editar(portaria));
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao(portaria);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar(portaria));
    });

    it('remoção concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarRemocao(portaria)).flush(...sucesso());
      await p.recarregarCom([decreto]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao(portaria)).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco ao botão de remover da linha', async () => {
      p.remover(portaria).focus();
      p.remover(portaria).click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(portaria));
    });
  });
});
