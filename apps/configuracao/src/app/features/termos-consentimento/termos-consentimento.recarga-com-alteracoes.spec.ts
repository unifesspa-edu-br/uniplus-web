import { afterEach, describe, expect, it } from 'vitest';
import {
  CenaDoDetalhe,
  CODIGOS,
  ID,
  LEITURA,
  PROMOVER,
  RASCUNHO,
  REVISADO,
  REVISAR,
  SEM_CONTEUDO,
  botaoOuNulo,
  montarDetalhe,
  recusar,
  revisarRecusando,
  termo,
} from './termos-consentimento.testing';

let cena: CenaDoDetalhe;
afterEach(() => cena.controller.verify());

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
      cena,
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
    await revisarRecusando(cena, 409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
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
    await revisarRecusando(cena, 409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
    cena.botao('Salvar rascunho').click();
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    await cena.propagar();
    expect(cena.edicao.leituraDefasada()).toBe(false);
    expect(botaoOuNulo(cena, 'Recarregar dados')).toBeNull();
    expect(cena.botao('Marcar como revisado').matches(':disabled')).toBe(false);
  });

  it('salvar o rascunho depois do conflito mantém o bloqueio e a recarga se a releitura falha', async () => {
    cena = await montarDetalhe(ID);
    await revisarRecusando(cena, 409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
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
    await revisarRecusando(cena, 409, CODIGOS.conflitoDeConcorrencia, 'Conflito');
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
    expect(botaoOuNulo(cena, 'Recarregar dados')).toBeNull();
  });
});
