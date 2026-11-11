import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { ok } from './testes';
import {
  api,
  documento,
  notificacoes,
  ENVIO,
  PDF,
  PERFIL_CRIADO,
  RECUSA_DO_NOME,
  abrir,
  abrirGravando,
  salvarPeloBotao,
  preencherOPerfil,
  assentar,
  concedidasAgora,
  presente,
  reiniciarDuplas,
  abrirOFormulario,
  formularioAberto,
} from './perfis.page.testing';

describe('PerfisPage: gravação do perfil novo', () => {
  beforeEach(reiniciarDuplas);

  describe('salvar o perfil novo', () => {
    beforeEach(() => api.criar.mockReturnValue(of(ok(ENVIO))));

    async function salvarOPerfil() {
      const aberta = await abrir();
      preencherOPerfil(await abrirOFormulario(aberta));
      await assentar(aberta.fixture);
      await salvarPeloBotao(aberta);
      return aberta;
    }

    it('cria o perfil com o protocolo e o tamanho do documento', async () => {
      await salvarOPerfil();

      expect(api.criar.mock.calls[0]?.[0]).toEqual(PERFIL_CRIADO);
    });

    it('sem o botão Novo perfil, devolve o foco ao título da lista depois de gravar', async () => {
      const aberta = await abrir();
      const { fixture, host } = aberta;
      const formulario = await abrirOFormulario(aberta);
      concedidasAgora.set([]);
      await assentar(fixture);
      expect(host.querySelector('#cfg-perfis-novo')).toBeNull();

      preencherOPerfil(formulario);
      await assentar(fixture);
      await salvarPeloBotao(aberta);

      expect(document.activeElement).toBe(host.querySelector('#cfg-perfis-titulo'));
    });

    it('envia o PDF pela URL devolvida e avisa', async () => {
      await salvarOPerfil();

      expect(documento.enviar).toHaveBeenCalledWith(ENVIO, PDF, expect.any(Function));
      expect(notificacoes.success).toHaveBeenCalledWith('Perfil criado');
    });

    it('fecha o formulário depois de gravar', async () => {
      const { host } = await salvarOPerfil();

      expect(formularioAberto(host)).toBe(false);
    });
  });

  describe('durante a gravação', () => {
    it('deixa os campos e o botão indisponíveis', async () => {
      const { host, botao } = await abrirGravando();

      const nome = host.querySelector('input[formControlName="nome"]:disabled');
      expect(nome).not.toBeNull();
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
    });

    it('não deixa fechar o formulário pelo botão nem pelo Esc', async () => {
      const { host } = await abrirGravando();

      const fechar = presente(host.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]'));
      const escape = new Event('cancel', { cancelable: true });
      presente(host.querySelector('dialog')).dispatchEvent(escape);

      expect(fechar.disabled).toBe(true);
      expect(escape.defaultPrevented).toBe(true);
    });

    it('mantém o foco no botão e recusa novo envio', async () => {
      const { fixture, botao } = await abrirGravando();

      botao.click();
      await assentar(fixture);

      expect(document.activeElement).toBe(botao);
      expect(api.criar).toHaveBeenCalledTimes(1);
    });

    it('fecha o formulário quando a gravação termina', async () => {
      const { fixture, host, resposta } = await abrirGravando();

      resposta.next(ok(ENVIO));
      resposta.complete();
      await assentar(fixture);

      expect(formularioAberto(host)).toBe(false);
    });
  });

  describe('com o nome recusado pelo servidor', () => {
    async function abrirRecusado() {
      api.criar.mockReturnValue(of(apiFailure(RECUSA_DO_NOME, 422, new HttpHeaders())));
      const aberta = await abrir();
      preencherOPerfil(await abrirOFormulario(aberta));
      await assentar(aberta.fixture);
      await salvarPeloBotao(aberta);
      await assentar(aberta.fixture);
      return presente(aberta.host.querySelector<HTMLInputElement>('input[formControlName="nome"]'));
    }

    it('mostra a recusa no campo, ligada pelo aria', async () => {
      const campo = await abrirRecusado();

      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.getAttribute('aria-describedby')).toBe('cfg-perfil-erro-nome');
      expect(document.body.textContent).toContain('Nome recusado.');
    });

    it('leva o foco ao campo recusado', async () => {
      const campo = await abrirRecusado();

      expect(document.activeElement).toBe(campo);
    });
  });
});
