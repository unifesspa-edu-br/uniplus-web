import {
  criado,
  ESCRITA,
  ID,
  indisponivel,
  montarPagina,
  Pagina,
  sucesso,
  unifesspa,
} from './instituicao.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('InstituicaoPage — escritas pela interface', () => {
  let p: Pagina;

  afterEach(() => p.http.verify());

  describe('cadastro', () => {
    beforeEach(async () => {
      p = await montarPagina(null);
    });

    it('envia o comando completo com a chave de idempotência, avisa o sucesso e mostra a ficha', async () => {
      await p.abrirCadastro();
      p.preencher('cnpj', '  11.222.333/0001-44 ');
      const post = await p.enviar();

      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toMatchObject({
        codigoEmec: '3990',
        nome: unifesspa.nome,
        sigla: 'Unifesspa',
        organizacaoAcademica: 'Universidade',
        categoriaAdministrativa: 'Pública Federal',
        cnpj: '11.222.333/0001-44',
        website: null,
        unidadeRaizId: null,
      });
      post.flush(...criado());
      await p.responderLeitura(unifesspa);

      expect(p.edicao.aberto()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Instituição criada');
      expect(p.statusDaPagina()).toBe('Instituição criada.');
      expect(p.elemento('.cfg-instituicao__ficha')).toBeTruthy();
    });

    it('não oferece a remoção antes de existir instituição', async () => {
      await p.abrirFormulario();

      expect(
        p.fixture.nativeElement.querySelector('.form-drawer__footer .btn--danger-ghost'),
      ).toBeNull();
    });

    it('pedir a remoção com o formulário de cadastro aberto não abre a confirmação', async () => {
      await p.abrirFormulario();
      p.edicao.pedirRemocao();
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(false);
    });

    it('marca os obrigatórios sem enviar e leva o foco ao primeiro inválido', async () => {
      await p.abrirFormulario();
      p.salvar().focus();
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone((r) => r.method === 'POST');
      expect(p.elemento('#cfg-instituicao-nome-erro').textContent).toContain('Campo obrigatório.');
      expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('nome').getAttribute('aria-describedby')).toBe('cfg-instituicao-nome-erro');
      expect(document.activeElement).toBe(p.campo('nome'));
      expect(p.edicao.aberto()).toBe(true);
    });

    it('recusa o valor acima do limite da API sem enviar', async () => {
      await p.abrirCadastro();
      p.preencher('sigla', 'S'.repeat(51));
      p.submeter();
      await p.propagar();

      p.http.expectNone((r) => r.method === 'POST');
      expect(p.elemento('#cfg-instituicao-sigla-erro').textContent).toContain(
        'Informe no máximo 50 caracteres.',
      );
    });
  });

  describe('edição', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('atualiza pela chave da instituição, avisa o sucesso e devolve o foco ao botão Editar', async () => {
      await p.abrirFormulario();
      expect(p.campo('nome').value).toBe(unifesspa.nome);
      p.preencher('nome', 'Universidade Federal do Sul e Sudeste do Pará (revisado)');
      const put = await p.enviar(`${ESCRITA}/${ID}`);

      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toMatchObject({
        id: ID,
        nome: 'Universidade Federal do Sul e Sudeste do Pará (revisado)',
        unidadeRaizId: unifesspa.unidadeRaizId,
      });
      put.flush(...sucesso());
      await p.responderLeitura({ ...unifesspa, nome: 'Revisada' });

      expect(p.sucessos).toHaveBeenCalledWith('Instituição atualizada');
      expect(p.statusDaPagina()).toBe('Instituição atualizada.');
      expect(document.activeElement).toBe(p.acao());
    });

    it('cancelar fecha sem enviar e devolve o foco ao botão Editar', async () => {
      await p.abrirFormulario();
      p.cancelarDoFormulario().click();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(false);
      p.http.expectNone((r) => r.method !== 'GET');
      expect(document.activeElement).toBe(p.acao());
    });
  });

  describe('recarga depois da escrita', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('mantém as ações indisponíveis até a tela refletir o que foi gravado', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(indisponivel(p.acao())).toBe(true);
      p.acao().click();
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      await p.responderLeitura(unifesspa);
      expect(p.edicao.gravando()).toBe(false);
      expect(indisponivel(p.acao())).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirFormulario();
          (await p.enviar(`${ESCRITA}/${ID}`)).flush(...sucesso());
        } else {
          (await p.confirmarRemocaoPeloFormulario()).flush(...sucesso());
        }
        await p.falharLeitura(503);

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('#cfg-instituicao-tentar-novamente');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.responderLeitura(unifesspa);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );

    it('com a recarga falha, leva o foco ao título da página', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...sucesso());
      await p.falharLeitura(503);

      expect(document.activeElement?.id).toBe('cfg-instituicao-titulo-da-pagina');
    });
  });
});
