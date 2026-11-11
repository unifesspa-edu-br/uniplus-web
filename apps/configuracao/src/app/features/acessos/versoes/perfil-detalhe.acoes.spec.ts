import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { ESCRITA, LEITURA, perfilDoDetalhe, versaoPendente } from './perfis.testing';
import { campoPorRotulo, codigosMarcados, digitar } from '../interacao.testing';
import { ok, recusa } from '../testes';
import {
  abrir,
  assentar,
  botao,
  documento,
  leitura,
  notificacoes,
  presente,
  reiniciarDuplas,
  versoes,
  escolherArquivo,
  abrirODialogoDeCancelamento,
  confirmarNoDialogo,
  preencherOMotivo,
} from './perfil-detalhe.testing';
import type { PerfilDetalhePage } from './perfil-detalhe.page';

type Fixture = ComponentFixture<PerfilDetalhePage>;

const ENVIO_DA_PROPOSTA = {
  perfilId: 'p1',
  versaoId: 'v3',
  urlDeEnvio: 'https://armazenamento.test/u',
  tipoDeMidia: 'application/pdf',
  expiraEm: '2026-11-10T12:00:00Z',
};

async function preencherAProposta(fixture: Fixture, host: HTMLElement): Promise<void> {
  presente(botao(host, 'Propor nova versão')).click();
  await assentar(fixture);
  const formulario = presente(host.querySelector<HTMLElement>('cfg-perfil-formulario'));
  digitar(campoPorRotulo(formulario, 'Protocolo'), 'P-9/2026');
  await escolherArquivo(fixture, 'cfg-perfil-formulario');
  const enviar = [...formulario.querySelectorAll<HTMLButtonElement>('button[type="submit"]')];
  presente(enviar.find((b) => b.textContent?.includes('Enviar proposta'))).click();
  await assentar(fixture);
}

const PROPOSTA_ESPERADA = expect.objectContaining({
  nome: 'Operador de inscrições',
  protocolo: 'P-9/2026',
  permissoes: [ESCRITA.codigo, LEITURA.codigo].sort(),
});

async function proporPelaTela(fixture: Fixture, host: HTMLElement): Promise<void> {
  versoes.propor.mockReturnValue(of(ok(ENVIO_DA_PROPOSTA)));
  documento.enviar.mockResolvedValue({ ok: true });
  await preencherAProposta(fixture, host);
}

async function cancelarComMotivo(fixture: Fixture, host: HTMLElement, motivo: string) {
  const dialogo = await abrirODialogoDeCancelamento(fixture, host);
  preencherOMotivo(dialogo, motivo);
  await confirmarNoDialogo(fixture, dialogo, 'Cancelar versão');
  return dialogo;
}

describe('PerfilDetalhePage: ações', () => {
  beforeEach(reiniciarDuplas);

  it('propor nova versão abre o formulário de proposta', async () => {
    const { fixture, host } = await abrir();

    presente(botao(host, 'Propor nova versão')).click();
    await assentar(fixture);

    const formulario = presente(host.querySelector('cfg-perfil-formulario'));
    expect(formulario.textContent).toContain('Propor nova versão');
  });

  it('propor nova versão marca as permissões em vigor', async () => {
    const { fixture, host } = await abrir();

    presente(botao(host, 'Propor nova versão')).click();
    await assentar(fixture);

    const formulario = presente(host.querySelector('cfg-perfil-formulario'));
    expect(codigosMarcados(formulario).sort()).toEqual([ESCRITA.codigo, LEITURA.codigo].sort());
  });

  it('propõe a versão com o protocolo e as permissões em vigor, sem mexer no resto', async () => {
    const { fixture, host } = await abrir();

    await proporPelaTela(fixture, host);

    expect(versoes.propor).toHaveBeenCalledWith('p1', PROPOSTA_ESPERADA, expect.anything());
  });

  it('envia o PDF escolhido depois de propor a versão', async () => {
    const { fixture, host } = await abrir();

    await proporPelaTela(fixture, host);

    expect(documento.enviar).toHaveBeenCalled();
  });

  describe('cancelar a versão pendente', () => {
    const pendente = () => ok(perfilDoDetalhe({ versaoPendente: versaoPendente() }));

    it('exige o motivo antes de chamar a API', async () => {
      const { fixture, host } = await abrir(pendente());
      const dialogo = await abrirODialogoDeCancelamento(fixture, host);

      await confirmarNoDialogo(fixture, dialogo, 'Cancelar versão');

      expect(versoes.cancelar).not.toHaveBeenCalled();
      expect(dialogo.textContent).toContain('Informe o motivo');
      expect(dialogo.open).toBe(true);
    });

    it('cancela com o motivo aparado e avisa', async () => {
      const { fixture, host } = await abrir(pendente());
      versoes.cancelar.mockReturnValue(of(ok(perfilDoDetalhe())));

      await cancelarComMotivo(fixture, host, ' Engano na composição. ');

      const chamada = ['p1', 'v2', 'Engano na composição.', expect.anything()];
      expect(versoes.cancelar).toHaveBeenCalledWith(...chamada);
      expect(notificacoes.success).toHaveBeenCalledWith('Versão pendente cancelada');
    });

    it('depois de cancelar, fecha o diálogo e relê o perfil sem a versão pendente', async () => {
      const { fixture, host } = await abrir(pendente());
      versoes.cancelar.mockReturnValue(of(ok(perfilDoDetalhe())));
      leitura.mockReturnValue(of(ok(perfilDoDetalhe())));

      const dialogo = await cancelarComMotivo(fixture, host, 'Engano.');

      expect(dialogo.open).toBe(false);
      expect(host.textContent).not.toContain('Versão pendente de aprovação');
    });

    it('mostra a recusa da API dentro do diálogo e o mantém aberto', async () => {
      const { fixture, host } = await abrir(pendente());
      const erro = recusa('uniplus.autorizacao.perfil.versao_nao_pendente', 409);
      versoes.cancelar.mockReturnValue(of(erro));

      const dialogo = await cancelarComMotivo(fixture, host, 'Engano.');

      expect(dialogo.textContent).toContain('A versão já foi decidida, cancelada ou substituída');
      expect(dialogo.open).toBe(true);
    });
  });

  describe('quem só aprova', () => {
    const SO_PROTECAO = [PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados];
    const SO_FUNCIONAL = [PERMISSAO.autorizacao.perfisAprovarFuncional];
    const SUSPENSO = {
      desde: '2026-11-05T12:00:00Z',
      papelDeQuemSuspendeu: 'gestao_de_acessos',
      etapasExigidasAgora: ['protecao_de_dados'],
      etapasDecididas: [],
    };

    it('decide a etapa da proteção de dados da retomada e não vê as ações de manutenção', async () => {
      const { host } = await abrir(ok(perfilDoDetalhe({ suspensao: SUSPENSO })), {
        concedidas: SO_PROTECAO,
      });

      expect(botao(host, 'Retomar: proteção de dados')).toBeDefined();
      const acoes = host.querySelector<HTMLElement>('.page-header__actions');
      for (const manutencao of ['Propor nova versão', 'Remover permissões', 'Desativar']) {
        expect(botao(presente(acoes), manutencao)).toBeUndefined();
      }
    });

    it('não vê reativar no perfil desativado nem cancelar a versão pendente', async () => {
      const desativado = await abrir(
        ok(perfilDoDetalhe({ ativo: false, desativadoDesde: '2026-11-01T12:00:00Z' })),
        { concedidas: SO_FUNCIONAL },
      );
      expect(botao(desativado.host, 'Reativar')).toBeUndefined();
      TestBed.resetTestingModule();

      const pendente = await abrir(ok(perfilDoDetalhe({ versaoPendente: versaoPendente() })), {
        concedidas: SO_FUNCIONAL,
      });
      expect(pendente.host.textContent).toContain('Versão pendente de aprovação');
      expect(botao(pendente.host, 'Cancelar versão pendente')).toBeUndefined();
    });

    it('quem mantém perfis segue vendo as ações de manutenção', async () => {
      const { host } = await abrir(ok(perfilDoDetalhe()), {
        concedidas: [PERMISSAO.autorizacao.perfisManter],
      });

      expect(botao(host, 'Propor nova versão')).toBeDefined();
      expect(botao(host, 'Remover permissões')).toBeDefined();
    });
  });
});
