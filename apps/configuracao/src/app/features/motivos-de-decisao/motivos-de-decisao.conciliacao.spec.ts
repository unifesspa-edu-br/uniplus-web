import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  FUNDAMENTOS,
  FUNDAMENTOS_DA_API,
  LISTA,
  Pagina,
  isencao,
  montarPagina,
  problema,
} from './motivos-de-decisao.testing';

const ATIVACAO = `${ESCRITA}/${isencao.id}/ativacao`;
const SEM_RESPOSTA = problema(503, { code: 'uniplus.internal.unexpected' });
const CONFIRMAR = '[data-testid="confirm-dialog-confirm"]';
const inativo = { ...isencao, ativo: false };

const FORMAS_DE_DISPENSAR_A_CONFIRMACAO = [
  {
    como: 'o botão Cancelar',
    dispensar: (p: Pagina) =>
      p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click(),
  },
  {
    como: 'o X do diálogo',
    dispensar: (p: Pagina) =>
      p.elemento<HTMLButtonElement>('ui-dialog button[aria-label="Fechar"]').click(),
  },
  {
    como: 'o Esc',
    dispensar: (p: Pagina) =>
      p
        .elemento<HTMLDialogElement>('ui-dialog dialog')
        .dispatchEvent(new Event('cancel', { cancelable: true })),
  },
];

const FORMAS_DE_DISPENSAR_O_FORMULARIO = [
  {
    como: 'o botão Cancelar',
    dispensar: (p: Pagina) =>
      Array.from(p.raiz().querySelectorAll<HTMLButtonElement>('ui-drawer button'))
        .find((botao) => botao.textContent?.trim() === 'Cancelar')
        ?.click(),
  },
  {
    como: 'o X da gaveta',
    dispensar: (p: Pagina) =>
      p.elemento<HTMLButtonElement>('ui-drawer button[aria-label="Fechar"]').click(),
  },
  {
    como: 'o Esc',
    dispensar: (p: Pagina) =>
      p
        .elemento<HTMLDialogElement>('ui-drawer dialog')
        .dispatchEvent(new Event('cancel', { cancelable: true })),
  },
];

describe('MotivosDeDecisaoPage: conciliação ao dispensar uma falha sem resposta conclusiva', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  async function confirmarComFalha(acao: string, falha = SEM_RESPOSTA): Promise<string | null> {
    p.pelaEtiqueta(`${acao} motivo RENDA_ACIMA_DO_LIMITE`).click();
    await p.propagar();
    p.elemento<HTMLButtonElement>(CONFIRMAR).click();
    const envio = p.http.expectOne(ATIVACAO);
    envio.flush(...falha);
    await p.propagar();
    return envio.request.headers.get('Idempotency-Key');
  }

  async function editarComFalha(): Promise<void> {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
    p.edicao.form.controls.descricao.setValue('Descrição enviada sem resposta.');
    p.edicao.salvar();
    p.http.expectOne(`${ESCRITA}/${isencao.id}`).flush(...SEM_RESPOSTA);
    await p.propagar();
  }

  describe.each(FORMAS_DE_DISPENSAR_A_CONFIRMACAO)(
    'dispensar a confirmação por $como',
    ({ dispensar }) => {
      it.each([
        { acao: 'Desativar', antes: isencao, depois: inativo, aparece: 'Reativar' },
        { acao: 'Reativar', antes: inativo, depois: isencao, aparece: 'Desativar' },
      ])(
        '$acao sem resposta: relê a lista, bloqueia as ações até a leitura terminar e mostra a ação certa',
        async ({ acao, antes, depois, aparece }) => {
          p = await montarPagina([antes]);
          await confirmarComFalha(acao);
          expect(p.edicao.confirmando()).toBe(true);

          dispensar(p);
          await p.propagar();

          expect(p.edicao.confirmando()).toBe(false);
          expect(p.edicao.gravando()).toBe(true);
          p.edicao.pedirMudancaDeSituacao(depois, !depois.ativo);
          expect(p.edicao.confirmando()).toBe(false);
          await p.lerLista([depois]);
          expect(p.edicao.gravando()).toBe(false);
          expect(p.pelaEtiqueta(`${aparece} motivo RENDA_ACIMA_DO_LIMITE`)).toBeTruthy();
        },
      );

      it('a mudança descartada não deixa a chave para a próxima confirmação', async () => {
        p = await montarPagina([isencao]);
        const chave = await confirmarComFalha('Desativar');

        dispensar(p);
        await p.propagar();
        await p.lerLista([isencao]);
        const nova = await confirmarComFalha('Desativar');

        expect(chave).toBeTruthy();
        expect(nova).not.toBe(chave);
      });

      it('recusa definitiva não pede releitura ao ser dispensada', async () => {
        p = await montarPagina([isencao]);
        await confirmarComFalha(
          'Desativar',
          problema(422, { code: 'uniplus.selecao.motivo_de_decisao.cobertura_insuficiente' }),
        );

        dispensar(p);
        await p.propagar();

        expect(p.edicao.confirmando()).toBe(false);
        expect(p.edicao.gravando()).toBe(false);
      });
    },
  );

  it('reenviar na mesma confirmação leva a mesma chave', async () => {
    p = await montarPagina([isencao]);
    const primeira = await confirmarComFalha('Desativar');

    p.elemento<HTMLButtonElement>(CONFIRMAR).click();
    const segunda = p.http.expectOne(ATIVACAO);
    segunda.flush(...SEM_RESPOSTA);
    await p.propagar();

    expect(segunda.request.headers.get('Idempotency-Key')).toBe(primeira);
  });

  describe.each(FORMAS_DE_DISPENSAR_O_FORMULARIO)(
    'dispensar o formulário por $como',
    ({ dispensar }) => {
      it('relê a lista e bloqueia as ações até a leitura terminar', async () => {
        await editarComFalha();

        dispensar(p);
        await p.propagar();

        expect(p.edicao.aberto()).toBe(false);
        expect(p.edicao.gravando()).toBe(true);
        p.edicao.abrirEdicao(isencao);
        expect(p.edicao.aberto()).toBe(false);
        await p.lerLista([{ ...isencao, descricao: 'Descrição já gravada no servidor.' }]);
        expect(p.edicao.aguardandoReenvio()).toBe(false);
      });
    },
  );

  describe('trocar a lista com algo pendente', () => {
    const trocarTipo = (): void => {
      const seletor = p.elemento<HTMLSelectElement>('[data-testid="motivos-tipo"]');
      seletor.value = 'HETEROIDENTIFICACAO';
      seletor.dispatchEvent(new Event('change'));
    };

    it('o tipo escolhido com a mudança sem resposta a descarta e lê a lista do novo tipo', async () => {
      p = await montarPagina([isencao]);
      const chave = await confirmarComFalha('Desativar');

      trocarTipo();
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(false);
      const leitura = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(leitura.request.params.get('tipo')).toBe('HETEROIDENTIFICACAO');
      leitura.flush([isencao]);
      await p.propagar();
      expect(await confirmarComFalha('Desativar')).not.toBe(chave);
    });

    it('o tipo escolhido com o envio sem resposta fecha o formulário e o libera', async () => {
      await editarComFalha();

      trocarTipo();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.aguardandoReenvio()).toBe(false);
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([]);
      await p.propagar();
    });

    it('a visão dos desativados com o envio sem resposta fecha o formulário e o libera', async () => {
      await editarComFalha();

      p.elemento<HTMLInputElement>('[data-testid="motivos-desativados"]').click();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.aguardandoReenvio()).toBe(false);
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([]);
      await p.propagar();
    });
  });
});
