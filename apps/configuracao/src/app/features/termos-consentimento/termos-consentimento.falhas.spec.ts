import { afterEach, describe, expect, it } from 'vitest';
import {
  CenaDoDetalhe,
  ADMIN,
  CODIGOS,
  ID,
  LEITURA,
  PROMOVER,
  REMOVER,
  REVISADO,
  REVISAR,
  SEM_CONTEUDO,
  chaveDe,
  montarDetalhe,
  recusar,
  recusarCampos,
  revisarRecusando,
} from './termos-consentimento.testing';

let cena: CenaDoDetalhe;
afterEach(() => cena.controller.verify());

describe('falhas das ações sobre o termo — chave de idempotência e avisos', () => {
  it('422: mostra a mensagem, renova a chave e não avisa por toast', async () => {
    cena = await montarDetalhe(ID);
    const primeira = await revisarRecusando(
      cena,
      422,
      CODIGOS.revisaoSemTexto,
      'Rascunho sem texto',
    );
    expect(cena.fixture.nativeElement.textContent).toContain('Rascunho sem texto');
    cena.botao('Marcar como revisado').click();
    expect(chaveDe(cena, REVISAR)).not.toBe(primeira);
    expect(cena.avisos()).toEqual([]);
  });

  it('409 de concorrência: mostra a mensagem, renova a chave e oferece recarregar os dados', async () => {
    cena = await montarDetalhe(ID);
    const primeira = await revisarRecusando(
      cena,
      409,
      CODIGOS.conflitoDeConcorrencia,
      'O rascunho foi modificado concorrentemente',
    );
    expect(cena.fixture.nativeElement.textContent).toContain(
      'O rascunho foi modificado concorrentemente',
    );
    expect(cena.avisos()).toEqual([]);
    const recarregar = cena.botao('Recarregar dados');
    recarregar.focus();
    recarregar.click();
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termoNaoRevisado());
    await cena.propagar();
    await cena.propagar();
    expect(document.activeElement).toBe(cena.titulo());
    cena.botao('Marcar como revisado').click();
    expect(chaveDe(cena, REVISAR)).not.toBe(primeira);
  });

  it('409 de processamento em curso: mantém a chave e mostra a mensagem', async () => {
    cena = await montarDetalhe(ID, REVISADO);
    cena.botao('Promover a versão').click();
    const primeira = cena.controller.expectOne(PROMOVER);
    const chave = primeira.request.headers.get('Idempotency-Key');
    recusar(primeira, 409, CODIGOS.processingConflict, 'Requisição em processamento');
    await cena.propagar();
    expect(cena.fixture.nativeElement.textContent).toContain('Requisição em processamento');
    expect(cena.avisos()).toEqual([]);
    cena.botao('Promover a versão').click();
    expect(chaveDe(cena, PROMOVER)).toBe(chave);
  });

  it('5xx: avisa por toast, mostra a mensagem e mantém a chave para repetir o mesmo comando', async () => {
    cena = await montarDetalhe(ID);
    const primeira = await revisarRecusando(cena, 500, CODIGOS.erroInterno, 'Erro interno');
    expect(cena.avisos()).toEqual(['Erro interno']);
    expect(cena.fixture.nativeElement.textContent).toContain('Erro interno');
    cena.botao('Marcar como revisado').click();
    expect(chaveDe(cena, REVISAR)).toBe(primeira);
  });

  it('um sucesso renova a chave da próxima ação', async () => {
    cena = await montarDetalhe(ID);
    cena.botao('Marcar como revisado').click();
    const primeira = cena.controller.expectOne(REVISAR);
    const chave = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(REVISADO);
    await cena.propagar();
    cena.botao('Promover a versão').click();
    expect(chaveDe(cena, PROMOVER)).not.toBe(chave);
  });
});

describe('falhas da remoção', () => {
  async function confirmarRemocao(): Promise<void> {
    cena.botao('Remover').click();
    await cena.propagar();
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
  }

  it('409 por versão promovida: o diálogo segue aberto com o motivo e o foco dentro dele', async () => {
    cena = await montarDetalhe(ID);
    await confirmarRemocao();
    recusar(
      cena.controller.expectOne(REMOVER),
      409,
      CODIGOS.remocaoBloqueada,
      'Termo com ao menos uma versão promovida não pode ser removido',
    );
    await cena.propagar();
    const dialogo = cena.elemento<HTMLDialogElement>('dialog');
    expect(dialogo.open).toBe(true);
    expect(dialogo.textContent).toContain('Termo com ao menos uma versão promovida');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'Não foi possível remover o termo Declaração de veracidade.',
    );
    expect(dialogo.contains(document.activeElement)).toBe(true);
    expect(cena.avisos()).toEqual([]);
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    await cena.propagar();
    expect(dialogo.open).toBe(false);
    expect(cena.fixture.nativeElement.textContent).toContain('Não foi possível concluir a ação');
  });

  it('5xx: avisa por toast e mantém o diálogo aberto para tentar de novo', async () => {
    cena = await montarDetalhe(ID);
    await confirmarRemocao();
    recusar(cena.controller.expectOne(REMOVER), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Erro interno']);
    const dialogo = cena.elemento<HTMLDialogElement>('dialog');
    expect(dialogo.open).toBe(true);
    expect(dialogo.contains(document.activeElement)).toBe(true);
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    cena.controller.expectOne(REMOVER).flush(null, SEM_CONTEUDO);
  });
});

describe('falhas da criação', () => {
  async function criarComNome(): Promise<void> {
    cena.edicao.criarForm.controls.nome.setValue('Termo novo');
    cena.botao('Criar termo').click();
    await cena.propagar();
  }

  it('422 com campo recusado marca o campo, renova a chave e leva o foco a ele', async () => {
    cena = await montarDetalhe(null);
    await criarComNome();
    const primeira = cena.controller.expectOne(ADMIN);
    const chave = primeira.request.headers.get('Idempotency-Key');
    recusarCampos(primeira, [
      { field: 'Nome', code: CODIGOS.nomeObrigatorio, message: 'Nome obrigatório.' },
    ]);
    await cena.propagar();
    await cena.propagar();
    const nome = cena.elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(nome.closest('label')?.textContent).toContain('Nome obrigatório.');
    expect(document.activeElement).toBe(nome);
    cena.botao('Criar termo').click();
    expect(chaveDe(cena, ADMIN)).not.toBe(chave);
  });

  it('422 sem campo conhecido pede para revisar os campos', async () => {
    cena = await montarDetalhe(null);
    await criarComNome();
    recusarCampos(cena.controller.expectOne(ADMIN), [
      { field: 'Outro', code: CODIGOS.textoTamanho, message: 'Recusado.' },
    ]);
    await cena.propagar();
    expect(cena.fixture.nativeElement.textContent).toContain(
      'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  });

  it('409 de processamento em curso mantém a chave; 5xx avisa por toast', async () => {
    cena = await montarDetalhe(null);
    await criarComNome();
    const primeira = cena.controller.expectOne(ADMIN);
    const chave = primeira.request.headers.get('Idempotency-Key');
    recusar(primeira, 409, CODIGOS.processingConflict, 'Requisição em processamento');
    await cena.propagar();
    expect(cena.fixture.nativeElement.textContent).toContain('Requisição em processamento');
    expect(cena.avisos()).toEqual([]);
    cena.botao('Criar termo').click();
    const segunda = cena.controller.expectOne(ADMIN);
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    recusar(segunda, 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Erro interno']);
  });
});

function termoNaoRevisado() {
  return { ...REVISADO, revisado: false, revisadoEm: null };
}
