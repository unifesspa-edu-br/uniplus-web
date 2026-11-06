import { TestRequest } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CRIADO,
  GRUPOS,
  PaginaDeTeste,
  SEM_CORPO,
  linha,
  linhas805,
  recusa,
} from './pesos-enem.testing';

const RES_900 = 'Res. 900/2026';
const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
const GRUPOS_COM_FALHA =
  'Tecnológica: Falha Humanística I: Falha Humanística II: Falha Saúde e Biológicas: Falha';
const MENSAGEM_NO_CADASTRO = `4 de 4 grupo(s) não foram criados. Corrija e tente novamente. ${GRUPOS_COM_FALHA}`;
const MENSAGEM_NA_EDICAO = `4 de 4 grupo(s) não foram salvos. Corrija e tente novamente. ${GRUPOS_COM_FALHA}`;

const linhas900 = GRUPOS.map((grupoCurso, indice) =>
  linha({
    id: `nova-${indice}`,
    resolucao: RES_900,
    grupoCurso,
    criadoEm: '2026-11-01T12:00:00Z',
  }),
);

const chaves = (envios: readonly TestRequest[]): string[] =>
  envios.map((envio) => envio.request.headers.get('Idempotency-Key') ?? '').sort();

describe('PesosEnemPage — foco após o cadastro e conflito de processamento', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });
  afterEach(() => t.verificar());

  const titulo = (): HTMLElement => t.elemento('#cfg-pesos-enem-titulo');

  async function cadastrarComSucesso(): Promise<void> {
    await t.abrirCadastro();
    const envios = await t.enviarCadastro();
    envios.forEach((envio, indice) => envio.flush(`novo-id-${indice}`, CRIADO));
    await t.propagar();
  }

  describe('cadastro concluído', () => {
    it('com a nova resolução vigente na recarga, o foco vai ao título da página', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await cadastrarComSucesso();
      await t.recarregarCom([...linhas900, ...linhas805]);

      expect(t.raiz.textContent).toContain(`Pesos — ${RES_900}`);
      expect(document.activeElement).toBe(titulo());
    });

    it('com a lista inicialmente vazia, o foco vai ao título da página', async () => {
      await t.carregarUmaPagina([]);
      await cadastrarComSucesso();
      await t.recarregarCom([...linhas900]);

      expect(t.raiz.textContent).toContain(`Pesos — ${RES_900}`);
      expect(document.activeElement).toBe(titulo());
    });

    it('com a recarga falha, a lista anterior segue e o foco fica no botão de cadastro, já disponível', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await cadastrarComSucesso();
      await t.propagar();
      t.expectListagem().flush(...recusa(503, 'uniplus.internal.unexpected'));
      await t.propagar();

      expect(t.gravacao.gravando()).toBe(false);
      const cadastrar = t.botao('Cadastrar nova resolução');
      expect(document.activeElement).toBe(cadastrar);
      expect(cadastrar.getAttribute('aria-disabled')).toBeNull();
    });
  });

  describe('conflito de processamento (processing_conflict)', () => {
    it('no cadastro, vai ao banner sem marcar campo e o reenvio usa a mesma chave', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirCadastro();
      const primeiro = await t.enviarCadastro();
      const primeirasChaves = chaves(primeiro);
      primeiro.forEach((envio) => envio.flush(...recusa(409, PROCESSANDO)));
      await t.propagar();

      expect(t.criacao.erro()).toBe(MENSAGEM_NO_CADASTRO);
      expect(t.raiz.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);

      const reenvio = await t.enviarCadastro();
      expect(chaves(reenvio)).toEqual(primeirasChaves);
      reenvio.forEach((envio, indice) => envio.flush(`novo-id-${indice}`, CRIADO));
      await t.propagar();
      await t.recarregarCom([...linhas900, ...linhas805]);
    });

    it('na edição, vai ao banner sem marcar campo e o reenvio usa a mesma chave', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirEdicao();
      const primeiro = await t.enviarEdicao();
      const primeirasChaves = chaves(primeiro);
      primeiro.forEach((envio) => envio.flush(...recusa(409, PROCESSANDO)));
      await t.propagar();

      expect(t.edicao.erro()).toBe(MENSAGEM_NA_EDICAO);
      expect(t.raiz.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);

      const reenvio = await t.enviarEdicao();
      expect(reenvio).toHaveLength(4);
      expect(chaves(reenvio)).toEqual(primeirasChaves);
      reenvio.forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
    });
  });
});
