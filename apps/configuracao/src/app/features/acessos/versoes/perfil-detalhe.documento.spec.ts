import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { perfilDoDetalhe, versaoPendente } from './perfis.testing';
import { ok } from '../testes';
import {
  abrir,
  assentar,
  botao,
  documento,
  leitura,
  notificacoes,
  presente,
  reiniciarDuplas,
  campoDeEnvio,
  arquivoPdf,
  escolherArquivo,
} from './perfil-detalhe.testing';

const PENDENTE_AGUARDANDO = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });

async function abrirAguardandoEnvio() {
  const resposta = ok(perfilDoDetalhe({ versaoPendente: PENDENTE_AGUARDANDO }));
  documento.reenviar.mockResolvedValue({ ok: true });
  return abrir(resposta);
}

describe('PerfilDetalhePage: documento da versão pendente', () => {
  beforeEach(reiniciarDuplas);

  describe('documento da versão pendente', () => {
    it('quem só aprova vê que falta o documento, sem o campo de envio', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'recusado' });
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })), {
        concedidas: [PERMISSAO.autorizacao.perfisAprovarFuncional],
      });

      expect(host.textContent).toContain('Quem mantém perfis precisa enviar outro PDF');
      expect(campoDeEnvio(fixture, 'cfg-versao-pendente')).toBeNull();
    });

    it('mostra a falha do envio junto ao campo e não avisa sucesso', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));
      documento.reenviar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });
      await escolherArquivo(fixture, 'cfg-versao-pendente');

      expect(fixture.nativeElement.textContent).toContain('Falha ao enviar o arquivo.');
      expect(notificacoes.success).not.toHaveBeenCalled();
    });

    it('depois de falha no envio, relê a versão e oferece a tentativa do estado lido', async () => {
      const recusado = versaoPendente({ situacaoDoDocumento: 'recusado' });
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: recusado })));
      const aguardando = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      leitura.mockReturnValue(of(ok(perfilDoDetalhe({ versaoPendente: aguardando }))));
      documento.reenviar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });
      const chamadasAntes = leitura.mock.calls.length;
      await escolherArquivo(fixture, 'cfg-versao-pendente');

      expect(leitura.mock.calls.length).toBeGreaterThan(chamadasAntes);
      expect(host.textContent).toContain('Falta o documento instituidor');
      expect(host.textContent).not.toContain('A verificação recusou o documento enviado.');
    });

    it('depois de confirmação sem resposta, relê e deixa de oferecer o envio quando já está em verificação', async () => {
      const aguardando = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture, host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: aguardando })));
      const emVerificacao = versaoPendente({ situacaoDoDocumento: 'em_verificacao' });
      leitura.mockReturnValue(of(ok(perfilDoDetalhe({ versaoPendente: emVerificacao }))));
      documento.reenviar.mockResolvedValue({
        ok: false,
        mensagem: 'Não foi possível confirmar o envio.',
      });
      await escolherArquivo(fixture, 'cfg-versao-pendente');

      expect(host.textContent).not.toContain('Falta o documento instituidor');
    });

    it('abrir o seletor e não escolher arquivo não envia nada', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'aguardando_envio' });
      const { fixture } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));
      await escolherArquivo(fixture, 'cfg-versao-pendente', null);

      expect(documento.reenviar).not.toHaveBeenCalled();
    });

    it('oferece o envio quando o documento aguarda o arquivo', async () => {
      const { host } = await abrirAguardandoEnvio();

      expect(host.textContent).toContain('Falta o documento instituidor');
    });

    it('reemite o envio quando a pessoa escolhe o PDF', async () => {
      const { fixture } = await abrirAguardandoEnvio();
      const arquivo = arquivoPdf();

      await escolherArquivo(fixture, 'cfg-versao-pendente', arquivo);

      const chamada = ['p1', PENDENTE_AGUARDANDO, arquivo, expect.any(Function)];
      expect(documento.reenviar).toHaveBeenCalledWith(...chamada);
    });

    it('mostra o nome do arquivo escolhido', async () => {
      const { fixture, host } = await abrirAguardandoEnvio();

      await escolherArquivo(fixture, 'cfg-versao-pendente');

      expect(host.querySelector('cfg-versao-pendente')?.textContent).toContain('portaria.pdf');
    });

    it('avisa que o documento segue para verificação depois do envio', async () => {
      const { fixture } = await abrirAguardandoEnvio();

      await escolherArquivo(fixture, 'cfg-versao-pendente');

      expect(notificacoes.success).toHaveBeenCalledWith(
        'Documento enviado',
        'Ele segue para verificação.',
      );
    });

    it('com o documento recusado na verificação, pede outro PDF', async () => {
      const pendente = versaoPendente({ situacaoDoDocumento: 'recusado' });
      const { host } = await abrir(ok(perfilDoDetalhe({ versaoPendente: pendente })));

      expect(host.textContent).toContain('A verificação recusou o documento enviado.');
    });

    it('com o documento verificado, não pede arquivo e abre o documento numa aba', async () => {
      const { fixture, host } = await abrir(
        ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })),
      );
      documento.abrir.mockResolvedValue('aberta');

      expect(host.querySelector('cfg-versao-pendente ui-file-upload')).toBeNull();
      const daPendente = [...host.querySelectorAll('cfg-versao-pendente button')].find(
        (b) => b.textContent?.trim() === 'Abrir documento',
      );
      (daPendente as HTMLButtonElement).click();
      await assentar(fixture);

      expect(documento.abrir).toHaveBeenCalledWith('p1', 'v2', expect.any(Function));
    });

    it('diz que o navegador bloqueou a aba do documento', async () => {
      const { fixture, host } = await abrir(
        ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })),
      );
      documento.abrir.mockResolvedValue('bloqueada');

      presente(botao(host, 'Abrir documento')).click();
      await assentar(fixture);

      expect(documento.abrir).toHaveBeenCalledWith('p1', 'v1', expect.any(Function));
      expect(host.textContent).toContain('O navegador bloqueou a abertura do documento.');
    });
  });
});
