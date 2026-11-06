import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  CenaDoDetalhe,
  CODIGOS,
  ID,
  LEITURA,
  RASCUNHO,
  REMOVER,
  REVISAR,
  SEM_CONTEUDO,
  montarDetalhe,
  recusar,
  recusarCampos,
  termo,
} from './termos-consentimento.testing';

let cena: CenaDoDetalhe;
afterEach(() => cena.controller.verify());

const submeter = (): void => {
  cena
    .elemento<HTMLFormElement>('form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};
const desabilitado = (seletor: string): boolean => cena.elemento(seletor).matches(':disabled');
const recusaDoTexto = [
  { field: 'textoRascunho', code: CODIGOS.textoTamanho, message: 'Texto recusado.' },
];

describe('rascunho — escritas pela interface', () => {
  async function iniciarEnvio(): Promise<HTMLButtonElement> {
    const salvar = cena.botao('Salvar rascunho');
    salvar.focus();
    salvar.click();
    await cena.propagar();
    return salvar;
  }

  it('envio pendente deixa o formulário somente leitura, mantém o foco e recusa nova ativação', async () => {
    cena = await montarDetalhe(ID);
    const salvar = await iniciarEnvio();
    for (const campo of ['textarea', 'input[formcontrolname="baseLegal"]', 'select']) {
      expect(desabilitado(campo)).toBe(true);
    }
    expect(cena.elemento<HTMLTextAreaElement>('textarea').value).toBe(termo().textoRascunho);
    expect(cena.edicao.rascunhoForm.controls.texto.enabled).toBe(true);
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(salvar);
    expect(cena.elemento('#cfg-termo-consentimento-anuncio').textContent).toBe(
      'Salvando o rascunho.',
    );
    for (const nome of ['Marcar como revisado', 'Remover']) {
      expect(cena.botao(nome).getAttribute('aria-disabled')).toBe('true');
      cena.botao(nome).click();
    }
    expect(cena.elemento('.cfg-voltar').getAttribute('aria-disabled')).toBe('true');
    salvar.click();
    submeter();
    cena.edicao.salvarRascunho();
    const envios = cena.controller.match(RASCUNHO);
    expect(envios).toHaveLength(1);
    cena.controller.expectNone(REVISAR);
    envios[0].flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    expect(desabilitado('textarea')).toBe(false);
    expect(salvar.getAttribute('aria-disabled')).toBeNull();
    expect(cena.elemento('#cfg-termo-consentimento-anuncio').textContent).toBe('');
  });

  it('campo desabilitado por regra continua desabilitado depois do sucesso e da recusa', async () => {
    cena = await montarDetalhe(ID);
    cena.edicao.rascunhoForm.controls.formaAceite.disable();
    await cena.propagar();
    expect(desabilitado('select')).toBe(true);
    submeter();
    recusarCampos(cena.controller.expectOne(RASCUNHO), recusaDoTexto);
    await cena.propagar();
    expect(desabilitado('select')).toBe(true);
    expect(desabilitado('textarea')).toBe(false);
    submeter();
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    expect(desabilitado('select')).toBe(true);
    expect(desabilitado('textarea')).toBe(false);
  });

  it('recusa de campo leva o foco a ele e o sucesso seguinte limpa a recusa', async () => {
    cena = await montarDetalhe(ID);
    cena.botao('Salvar rascunho').focus();
    cena.botao('Salvar rascunho').click();
    await cena.propagar();
    recusarCampos(cena.controller.expectOne(RASCUNHO), recusaDoTexto);
    await cena.propagar();
    await cena.propagar();
    const texto = cena.elemento<HTMLTextAreaElement>('textarea');
    expect(texto.getAttribute('aria-invalid')).toBe('true');
    expect(texto.closest('label')?.textContent).toContain('Texto recusado.');
    expect(document.activeElement).toBe(texto);
    cena.botao('Salvar rascunho').click();
    await cena.propagar();
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();
    expect(texto.getAttribute('aria-invalid')).toBeNull();
    expect(document.activeElement).toBe(cena.botao('Salvar rascunho'));
  });

  it('Enter num campo leva o foco ao botão e, no 500, o envio segue disponível', async () => {
    cena = await montarDetalhe(ID);
    const texto = cena.elemento<HTMLTextAreaElement>('textarea');
    texto.focus();
    submeter();
    await cena.propagar();
    await cena.propagar();
    expect(document.activeElement).toBe(cena.botao('Salvando...'));
    recusar(cena.controller.expectOne(RASCUNHO), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    await cena.propagar();
    expect(desabilitado('textarea')).toBe(false);
    expect(cena.avisos()).toEqual(['Erro interno']);
    expect(document.activeElement).toBe(cena.botao('Salvar rascunho'));
  });

  it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
    cena = await montarDetalhe(ID);
    cena.edicao.rascunhoForm.controls.baseLegal.setValue('x'.repeat(501));
    cena.botao('Salvar rascunho').focus();
    cena.botao('Salvar rascunho').click();
    await cena.propagar();
    await cena.propagar();
    const base = cena.elemento<HTMLInputElement>('input[formcontrolname="baseLegal"]');
    expect(base.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(base);
    cena.controller.expectNone(RASCUNHO);
  });

  it('escritas concorrentes são recusadas durante o salvamento e a releitura', async () => {
    cena = await montarDetalhe(ID);
    cena.edicao.salvarRascunho();
    cena.edicao.salvarRascunho();
    cena.edicao.marcarRevisado();
    cena.edicao.pedirRemocao();
    cena.edicao.removerConfirmado();
    cena.controller.expectNone(REVISAR);
    cena.controller.expectNone(REMOVER);
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    const releitura = cena.controller.expectOne(LEITURA);
    cena.edicao.marcarRevisado();
    cena.edicao.salvarRascunho();
    cena.controller.expectNone(REVISAR);
    cena.controller.expectNone(RASCUNHO);
    releitura.flush(termo());
    await cena.propagar();
    cena.edicao.marcarRevisado();
    cena.controller.expectOne(REVISAR).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo({ revisado: true }));
    await cena.propagar();
    expect(cena.edicao.confirmRemoverAberto()).toBe(false);
  });

  it('associa os erros e as dicas aos campos do rascunho', async () => {
    cena = await montarDetalhe(ID);
    for (const controle of Object.values(cena.edicao.rascunhoForm.controls)) {
      controle.setErrors({ backend: { message: 'Campo recusado.' } });
      controle.markAsTouched();
    }
    await cena.propagar();
    for (const nome of ['texto', 'baseLegal', 'formaAceite']) {
      const ids =
        cena.elemento(`[formcontrolname="${nome}"]`).getAttribute('aria-describedby')?.split(' ') ??
        [];
      expect(ids.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain(
        'Campo recusado.',
      );
    }
  });
});

describe('remoção — escritas pela interface', () => {
  async function abrirEConfirmar(): Promise<HTMLButtonElement> {
    cena.botao('Remover').click();
    await cena.propagar();
    const confirmar = cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
    confirmar.click();
    await cena.propagar();
    return confirmar;
  }

  it('remoção pendente anuncia o andamento e impede confirmar, fechar ou agir de novo', async () => {
    cena = await montarDetalhe(ID);
    const confirmar = await abrirEConfirmar();
    const requisicao = cena.controller.expectOne(REMOVER);
    const dialogo = cena.elemento<HTMLDialogElement>('dialog');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'Removendo o termo Declaração de veracidade.',
    );
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(confirmar);
    expect(dialogo.querySelector('[aria-label="Fechar"]')?.matches(':disabled')).toBe(true);
    expect(
      dialogo.querySelector('[data-testid="confirm-dialog-cancel"]')?.matches(':disabled'),
    ).toBe(true);
    cena.edicao.salvarRascunho();
    cena.edicao.marcarRevisado();
    confirmar.click();
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await cena.propagar();
    expect(dialogo.open).toBe(true);
    cena.controller.expectNone(RASCUNHO);
    cena.controller.expectNone(REVISAR);
    cena.controller.expectNone(REMOVER);
    requisicao.flush(null, SEM_CONTEUDO);
    await cena.propagar();
    expect(dialogo.open).toBe(false);
  });

  it('uma remoção em curso não se passa por salvamento, nem o contrário', async () => {
    cena = await montarDetalhe(ID);
    const salvar = cena.botao('Salvar rascunho');
    cena.edicao.salvarRascunho();
    await cena.propagar();
    expect(cena.edicao.removendo()).toBe(false);
    expect(cena.edicao.criando()).toBe(false);
    expect(cena.edicao.acaoEmAndamento()).toBe('rascunho');
    cena.controller.expectOne(RASCUNHO).flush(null, SEM_CONTEUDO);
    await cena.propagar();
    cena.controller.expectOne(LEITURA).flush(termo());
    await cena.propagar();

    await abrirEConfirmar();
    expect(cena.edicao.removendo()).toBe(true);
    expect(cena.edicao.acaoEmAndamento()).toBe('remover');
    expect(salvar.textContent?.trim()).toBe('Salvar rascunho');
    expect(salvar.getAttribute('aria-busy')).toBeNull();
    cena.controller.expectOne(REMOVER).flush(null, SEM_CONTEUDO);
    await cena.propagar();
  });

  it('depois da recusa o diálogo aceita nova tentativa e o cancelamento', async () => {
    cena = await montarDetalhe(ID);
    const confirmar = await abrirEConfirmar();
    recusar(cena.controller.expectOne(REMOVER), 409, CODIGOS.remocaoBloqueada, 'Remoção bloqueada');
    await cena.propagar();
    expect(confirmar.getAttribute('aria-disabled')).toBeNull();
    confirmar.click();
    await cena.propagar();
    const dialogo = cena.elemento<HTMLDialogElement>('dialog');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain('Removendo');
    recusar(cena.controller.expectOne(REMOVER), 409, CODIGOS.remocaoBloqueada, 'Remoção bloqueada');
    await cena.propagar();
    cena.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    await cena.propagar();
    expect(dialogo.open).toBe(false);
  });
});

describe('criação — escritas pela interface', () => {
  const nome = (): HTMLInputElement => cena.elemento('input[formcontrolname="nome"]');

  it('identifica o nome como obrigatório e associa erros e dicas aos campos', async () => {
    cena = await montarDetalhe(null);
    expect(nome().getAttribute('aria-required')).toBe('true');
    for (const controle of Object.values(cena.edicao.criarForm.controls)) {
      controle.setErrors({ backend: { message: 'Campo recusado.' } });
      controle.markAsTouched();
    }
    await cena.propagar();
    for (const campo of ['nome', 'texto', 'baseLegal', 'formaAceite']) {
      const ids =
        cena
          .elemento(`[formcontrolname="${campo}"]`)
          .getAttribute('aria-describedby')
          ?.split(' ') ?? [];
      expect(ids.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain(
        'Campo recusado.',
      );
    }
  });

  it('criação pendente mantém campos e navegação indisponíveis e recusa reenvios', async () => {
    cena = await montarDetalhe(null);
    nome().value = 'Declaração de veracidade';
    nome().dispatchEvent(new Event('input'));
    const criar = cena.botao('Criar termo');
    criar.focus();
    criar.click();
    await cena.propagar();
    expect(desabilitado('input[formcontrolname="nome"]')).toBe(true);
    expect(desabilitado('textarea')).toBe(true);
    expect(nome().value).toBe('Declaração de veracidade');
    expect(criar.getAttribute('aria-disabled')).toBe('true');
    expect(criar.getAttribute('aria-busy')).toBe('true');
    expect(criar.textContent).toContain('Criando...');
    expect(document.activeElement).toBe(criar);
    expect(cena.elemento('#cfg-termo-consentimento-anuncio').textContent).toBe('Criando o termo.');
    expect(cena.elemento('.cfg-voltar').getAttribute('aria-disabled')).toBe('true');
    criar.click();
    submeter();
    const envios = cena.controller.match(ADMIN);
    expect(envios).toHaveLength(1);
    expect(envios[0].request.body).toMatchObject({ nome: 'Declaração de veracidade' });
    envios[0].flush(ID, { status: 201, statusText: 'Created' });
    await cena.propagar();
    expect(cena.avisos()).toEqual(['Termo criado']);
  });

  it('envio barrado localmente leva o foco ao nome', async () => {
    cena = await montarDetalhe(null);
    cena.botao('Criar termo').focus();
    cena.botao('Criar termo').click();
    await cena.propagar();
    await cena.propagar();
    expect(nome().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(nome());
    cena.controller.expectNone(ADMIN);
  });

  it('Enter no nome leva o foco ao botão e, no 500, o envio segue disponível', async () => {
    cena = await montarDetalhe(null);
    cena.edicao.criarForm.controls.nome.setValue('Termo novo');
    nome().focus();
    submeter();
    await cena.propagar();
    await cena.propagar();
    expect(document.activeElement).toBe(cena.botao('Criando...'));
    recusar(cena.controller.expectOne(ADMIN), 500, CODIGOS.erroInterno, 'Erro interno');
    await cena.propagar();
    await cena.propagar();
    expect(desabilitado('input[formcontrolname="nome"]')).toBe(false);
    expect(document.activeElement).toBe(cena.botao('Criar termo'));
    expect(cena.avisos()).toEqual(['Erro interno']);
  });
});
