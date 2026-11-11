import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LEITURA, perfilDoDetalhe, versaoPendente } from './perfis.testing';
import { ok, recusa } from '../testes';
import {
  REMOCAO_DA_TELA,
  abrir,
  abrirODialogoDeRemocao,
  assentar,
  botaoDoDialogoDeRemocao,
  notificacoes,
  perfis,
  preencherARemocao,
  prepararARemocao,
  recusaDeCampos,
  reiniciarDuplas,
  type Assentavel,
  type ErroDeCampo,
} from './perfil-detalhe.testing';

const REMOCAO_ESPERADA = {
  permissoes: [LEITURA.codigo],
  motivo: 'Acesso excessivo.',
  categoria: 'erro_de_composicao',
};
const ERRO_DE_MOTIVO = { field: 'Motivo', code: 'motivo_invalido', message: 'Motivo recusado.' };
const ERRO_DE_PERMISSAO = {
  field: 'Permissoes',
  code: 'permissao_inexistente',
  message: 'Permissão fora da versão.',
};

const perfilComPendente = () => perfilDoDetalhe({ versaoPendente: versaoPendente() });

async function confirmarARemocao(fixture: Assentavel, host: HTMLElement): Promise<void> {
  botaoDoDialogoDeRemocao(host).click();
  await assentar(fixture);
}

async function removerComMotivo(
  fixture: Parameters<typeof prepararARemocao>[0],
  host: HTMLElement,
) {
  perfis.remover.mockReturnValue(of(ok(perfilDoDetalhe())));
  const dialogo = await abrirODialogoDeRemocao(fixture, host);
  const dados = {
    ...REMOCAO_DA_TELA,
    motivo: ' Acesso excessivo. ',
    categoria: 'erro_de_composicao',
  };
  preencherARemocao(dialogo, dados);
  await confirmarARemocao(fixture, host);
  return dialogo;
}

async function recusarARemocao(
  fixture: Parameters<typeof prepararARemocao>[0],
  host: HTMLElement,
  ...erros: ErroDeCampo[]
) {
  const dialogo = await prepararARemocao(fixture, host);
  perfis.remover.mockReturnValue(of(recusaDeCampos(...erros)));
  await confirmarARemocao(fixture, host);
  return dialogo;
}

describe('PerfilDetalhePage: remoção de permissões', () => {
  beforeEach(reiniciarDuplas);

  describe('remover permissões', () => {
    it('com permissão, motivo e categoria, chama a API com o motivo aparado', async () => {
      const { fixture, host } = await abrir();

      await removerComMotivo(fixture, host);

      expect(perfis.remover).toHaveBeenCalledWith('p1', REMOCAO_ESPERADA, expect.anything());
    });

    it('depois de remover, fecha o diálogo e avisa', async () => {
      const { fixture, host } = await abrir();

      const dialogo = await removerComMotivo(fixture, host);

      expect(dialogo.open).toBe(false);
      expect(notificacoes.success).toHaveBeenCalledWith('Permissões removidas');
    });

    it('mostra a recusa do motivo no campo', async () => {
      const { fixture, host } = await abrir();

      const dialogo = await recusarARemocao(fixture, host, ERRO_DE_MOTIVO, ERRO_DE_PERMISSAO);

      expect(dialogo.textContent).toContain('Motivo recusado.');
    });

    it('mostra a recusa das permissões junto à lista e mantém o diálogo aberto', async () => {
      const { fixture, host } = await abrir();

      const dialogo = await recusarARemocao(fixture, host, ERRO_DE_MOTIVO, ERRO_DE_PERMISSAO);

      expect(dialogo.textContent).toContain('Permissão fora da versão.');
      expect(dialogo.open).toBe(true);
    });
  });

  describe('diálogo de remoção', () => {
    it('avisa que cancela a versão pendente e lista as permissões em vigor', async () => {
      const { fixture, host } = await abrir(ok(perfilComPendente()));

      const dialogo = await abrirODialogoDeRemocao(fixture, host);

      expect(dialogo.textContent).toContain('Ela cancela a versão pendente.');
      expect(dialogo.textContent).toContain('Configurar processos');
    });

    it('ao confirmar vazio, aponta o que falta e não chama a API', async () => {
      const { fixture, host } = await abrir();
      const dialogo = await abrirODialogoDeRemocao(fixture, host);

      await confirmarARemocao(fixture, host);

      expect(dialogo.textContent).toContain('Marque ao menos uma permissão a remover.');
      expect(dialogo.textContent).toContain('Campo obrigatório.');
      expect(dialogo.open).toBe(true);
      expect(perfis.remover).not.toHaveBeenCalled();
    });

    it('ao confirmar vazio, leva o foco à lista de permissões', async () => {
      const { fixture, host } = await abrir();
      await abrirODialogoDeRemocao(fixture, host);

      await confirmarARemocao(fixture, host);

      const grupo = document.activeElement?.closest('fieldset.field');
      expect(grupo?.textContent).toContain('Permissões a remover');
    });

    it('leva o foco ao campo que a API recusou', async () => {
      const { fixture, host } = await abrir();

      await recusarARemocao(fixture, host, ERRO_DE_MOTIVO);

      expect(document.activeElement?.tagName).toBe('TEXTAREA');
    });

    it('leva o foco ao aviso quando a recusa não é de campo', async () => {
      const { fixture, host } = await abrir();
      await prepararARemocao(fixture, host);
      const erro = recusa('uniplus.autorizacao.perfil.sem_versao_em_vigor', 422);
      perfis.remover.mockReturnValue(of(erro));

      await confirmarARemocao(fixture, host);

      expect(document.activeElement?.id).toBe('cfg-remocao-aviso');
    });
  });
});
