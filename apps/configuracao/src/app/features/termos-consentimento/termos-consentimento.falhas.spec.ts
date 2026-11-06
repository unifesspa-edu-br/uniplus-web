import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  CenaDoDetalhe,
  CODIGOS,
  ID,
  LEITURA,
  PROMOVER,
  RASCUNHO,
  REMOVER,
  REVISADO,
  REVISAR,
  SEM_CONTEUDO,
  montarDetalhe,
  recusar,
  recusarCampos,
  termo,
} from './termos-consentimento.testing';

let cena: CenaDoDetalhe;
afterEach(() => cena.controller.verify());

const chaveDe = (url: string): string | null =>
  cena.controller.expectOne(url).request.headers.get('Idempotency-Key');

const botaoOuNulo = (texto: string): HTMLButtonElement | null =>
  [...(cena.fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === texto,
  ) ?? null;

/** Aciona a revisão, recusa e devolve a chave da primeira tentativa. */
async function revisarRecusando(status: number, code: string, title: string): Promise<string> {
  cena.botao('Marcar como revisado').click();
  const primeira = cena.controller.expectOne(REVISAR);
  const chave = primeira.request.headers.get('Idempotency-Key') ?? '';
  recusar(primeira, status, code, title);
  await cena.propagar();
  return chave;
}

describe('falhas das ações sobre o termo — chave de idempotência e avisos', () => {
  it('422: mostra a mensagem, renova a chave e não avisa por toast', async () => {
    cena = await montarDetalhe(ID);
    const primeira = await revisarRecusando(422, CODIGOS.revisaoSemTexto, 'Rascunho sem texto');
    expect(cena.fixture.nativeElement.textContent).toContain('Rascunho sem texto');
    cena.botao('Marcar como revisado').click();
    expect(chaveDe(REVISAR)).not.toBe(primeira);
    expect(cena.avisos()).toEqual([]);
  });

  it('409 de concorrência: mostra a mensagem, renova a chave e oferece recarregar os dados', async () => {
    cena = await montarDetalhe(ID);
    const primeira = await revisarRecusando(
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
    cena.controller.expectOne(LEITURA).flush(termo2());
    await cena.propagar();
    await cena.propagar();
    expect(document.activeElement).toBe(cena.titulo());
    cena.botao('Marcar como revisado').click();
    expect(chaveDe(REVISAR)).not.toBe(primeira);
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
    expect(chaveDe(PROMOVER)).toBe(chave);
  });

  it('5xx: avisa por toast, mostra a mensagem e mantém a chave para repetir o mesmo comando', async () => {
    cena = await montarDetalhe(ID);
    const primeira = await revisarRecusando(500, CODIGOS.erroInterno, 'Erro interno');
    expect(cena.avisos()).toEqual(['Erro interno']);
    expect(cena.fixture.nativeElement.textContent).toContain('Erro interno');
    cena.botao('Marcar como revisado').click();
    expect(chaveDe(REVISAR)).toBe(primeira);
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
    expect(chaveDe(PROMOVER)).not.toBe(chave);
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
    expect(chaveDe(ADMIN)).not.toBe(chave);
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

describe('recarga com alterações não salvas no rascunho', () => {
  const dialogoDaRecarga = (): HTMLDialogElement =>
    [...cena.fixture.nativeElement.querySelectorAll('dialog')].find((item: HTMLDialogElement) =>
      item.textContent?.includes('Descartar'),
    ) as HTMLDialogElement;
  const decidir = async (testid: string): Promise<void> => {
    cena.elemento<HTMLButtonElement>(`[data-testid="${testid}"]`).click();
    await cena.propagar();
  };

  async function conflitoComTextoDigitado(sujo = true): Promise<HTMLButtonElement> {
    cena = await montarDetalhe(ID);
    cena.edicao.rascunhoForm.controls.texto.setValue('Texto digitado');
    if (sujo) cena.edicao.rascunhoForm.markAsDirty();
    await revisarRecusando(
      409,
      CODIGOS.conflitoDeConcorrencia,
      'O rascunho foi modificado concorrentemente',
    );
    const recarregar = cena.botao('Recarregar dados');
    recarregar.focus();
    recarregar.click();
    await cena.propagar();
    return recarregar;
  }

  it('pede confirmação, avisa do descarte e não relê enquanto a pessoa decide', async () => {
    await conflitoComTextoDigitado();
    expect(dialogoDaRecarga().open).toBe(true);
    expect(dialogoDaRecarga().textContent).toContain('As alterações não salvas serão descartadas');
    cena.controller.expectNone(LEITURA);
  });

  it('cancelar mantém o texto e devolve o foco ao acionador', async () => {
    const recarregar = await conflitoComTextoDigitado();
    await decidir('recarga-continuar-editando');
    expect(dialogoDaRecarga().open).toBe(false);
    expect(cena.edicao.rascunhoForm.controls.texto.value).toBe('Texto digitado');
    expect(document.activeElement).toBe(recarregar);
    cena.controller.expectNone(LEITURA);
  });

  it('confirmar relê o termo e troca o texto digitado pelo gravado', async () => {
    await conflitoComTextoDigitado();
    await decidir('recarga-descartar');
    cena.controller.expectOne(LEITURA).flush(termo({ textoRascunho: 'Texto do servidor' }));
    await cena.propagar();
    await cena.propagar();
    expect(dialogoDaRecarga().open).toBe(false);
    expect(cena.edicao.rascunhoForm.controls.texto.value).toBe('Texto do servidor');
    expect(document.activeElement).toBe(cena.titulo());
  });

  it('sem alterações não salvas, recarrega sem perguntar', async () => {
    await conflitoComTextoDigitado(false);
    expect(dialogoDaRecarga().open).toBe(false);
    cena.controller.expectOne(LEITURA).flush(termo());
  });

  it('"Tentar novamente" depois de uma releitura com falha também pergunta', async () => {
    cena = await montarDetalhe(ID);
    cena.edicao.rascunhoForm.controls.texto.setValue('Texto digitado');
    cena.edicao.rascunhoForm.markAsDirty();
    cena.botao('Marcar como revisado').click();
    cena.controller.expectOne(REVISAR).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    recusar(cena.controller.expectOne(LEITURA), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    cena.botao('Tentar novamente').click();
    await cena.propagar();
    expect(dialogoDaRecarga().open).toBe(true);
    cena.controller.expectNone(LEITURA);
    await decidir('recarga-continuar-editando');
    expect(cena.edicao.rascunhoForm.controls.texto.value).toBe('Texto digitado');
  });
});

describe('leitura defasada depois de conflito de concorrência', () => {
  const motivo = (nome: string): string | null =>
    cena.elemento(`[aria-label="${nome} indisponível"]`).getAttribute('data-tooltip');

  async function recarregarDados(leitura: ReturnType<typeof termo>): Promise<void> {
    cena.botao('Recarregar dados').click();
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(leitura);
    await cena.propagar();
    await cena.propagar();
  }

  it('revisar e promover ficam bloqueados, com o motivo, e nenhum POST sai', async () => {
    cena = await montarDetalhe(ID, REVISADO);
    cena.botao('Promover a versão').click();
    recusar(
      cena.controller.expectOne(PROMOVER),
      409,
      CODIGOS.conflitoDeConcorrencia,
      'O rascunho foi modificado concorrentemente',
    );
    await cena.propagar();
    for (const nome of ['Marcar como revisado', 'Promover a versão']) {
      expect(cena.botao(nome).matches(':disabled')).toBe(true);
      expect(motivo(nome)).toContain('Recarregue os dados');
    }
    cena.edicao.marcarRevisado();
    cena.edicao.promoverVersao();
    cena.controller.expectNone(REVISAR);
    cena.controller.expectNone(PROMOVER);
  });

  it('a recarga libera revisar e promover', async () => {
    cena = await montarDetalhe(ID, REVISADO);
    cena.botao('Promover a versão').click();
    recusar(
      cena.controller.expectOne(PROMOVER),
      409,
      CODIGOS.conflitoDeConcorrencia,
      'O rascunho foi modificado concorrentemente',
    );
    await cena.propagar();
    await recarregarDados({ ...REVISADO });
    expect(cena.botao('Marcar como revisado').matches(':disabled')).toBe(false);
    expect(cena.botao('Promover a versão').matches(':disabled')).toBe(false);
    cena.edicao.marcarRevisado();
    cena.controller.expectOne(REVISAR);
  });

  it('a recarga que falha mantém o bloqueio', async () => {
    cena = await montarDetalhe(ID);
    await revisarRecusando(409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
    cena.botao('Recarregar dados').click();
    await cena.propagar();
    recusar(cena.controller.expectOne(LEITURA), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    cena.edicao.marcarRevisado();
    cena.controller.expectNone(REVISAR);
  });

  it('o conflito ao salvar o rascunho também bloqueia revisar, mas não salvar de novo', async () => {
    cena = await montarDetalhe(ID);
    cena.botao('Salvar rascunho').click();
    recusar(
      cena.controller.expectOne(RASCUNHO),
      409,
      CODIGOS.conflitoDeConcorrencia,
      'O rascunho foi modificado concorrentemente',
    );
    await cena.propagar();
    cena.edicao.marcarRevisado();
    cena.controller.expectNone(REVISAR);
    cena.edicao.salvarRascunho();
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    expect(cena.edicao.leituraDefasada()).toBe(false);
    cena.edicao.marcarRevisado();
    cena.controller.expectOne(REVISAR);
  });

  it('salvar o rascunho depois do conflito libera o bloqueio quando a releitura dá certo', async () => {
    cena = await montarDetalhe(ID);
    await revisarRecusando(409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
    cena.botao('Salvar rascunho').click();
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    await cena.propagar();
    expect(cena.edicao.leituraDefasada()).toBe(false);
    expect(botaoOuNulo('Recarregar dados')).toBeNull();
    expect(cena.botao('Marcar como revisado').matches(':disabled')).toBe(false);
  });

  it('salvar o rascunho depois do conflito mantém o bloqueio e a recarga se a releitura falha', async () => {
    cena = await montarDetalhe(ID);
    await revisarRecusando(409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
    cena.botao('Salvar rascunho').click();
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    recusar(cena.controller.expectOne(LEITURA), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    expect(cena.edicao.leituraDefasada()).toBe(true);
    cena.edicao.marcarRevisado();
    cena.controller.expectNone(REVISAR);
    cena.botao('Tentar novamente').click();
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    expect(cena.edicao.leituraDefasada()).toBe(false);
  });

  it('abrir e cancelar a remoção depois do conflito mantém o botão de recarregar', async () => {
    cena = await montarDetalhe(ID);
    await revisarRecusando(409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
    cena.botao('Remover').click();
    await cena.propagar();
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    await cena.propagar();
    expect(cena.edicao.acaoErro()).toBeNull();
    expect(cena.edicao.leituraDefasada()).toBe(true);
    cena.botao('Recarregar dados').click();
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    expect(cena.edicao.leituraDefasada()).toBe(false);
    expect(botaoOuNulo('Recarregar dados')).toBeNull();
  });
});

function termo2() {
  return { ...REVISADO, revisado: false, revisadoEm: null };
}
