import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  analiseDocumental,
  criado,
  montarPagina,
  prova,
  sucesso,
} from './tipos-etapa.testing';

describe('TiposEtapaPage', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([analiseDocumental, prova]);
  });
  afterEach(() => p.http.verify());

  const linhaDe = (codigo: string): HTMLElement => {
    const linhas = [...p.fixture.nativeElement.querySelectorAll('tbody tr')] as HTMLElement[];
    const linha = linhas.find((item) => item.textContent?.includes(codigo));
    expect(linha, `linha de ${codigo}`).toBeTruthy();
    return linha as HTMLElement;
  };

  it('lista os tipos descrevendo em prosa o que cada um admite', () => {
    expect(linhaDe('ANALISE_DOCUMENTAL').textContent).toContain('Só eliminar');
    expect(linhaDe('PROVA').textContent).toContain('Compor a nota final e eliminar');
  });

  it('pede a primeira página com o limite da tela', async () => {
    p.store.recarregar();
    await p.propagar();
    const req = p.http.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush([prova]);
    await p.propagar();
  });

  it('identifica código e nome como obrigatórios para tecnologias assistivas', async () => {
    await p.abrirCadastro();
    for (const nome of ['codigo', 'nome']) {
      expect(p.campo(nome).getAttribute('aria-required')).toBe('true');
    }
  });

  it('cria o tipo declarando o que ele admite, anuncia e avisa o sucesso', async () => {
    await p.abrirCadastro();
    p.elemento<HTMLElement>('label.checkbox').click();
    const post = await p.enviar();
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toEqual({
      codigo: 'NOVA_PROVA',
      nome: 'Nova prova',
      admitePontuacao: false,
      admiteEliminacao: true,
      descricao: null,
    });
    post.flush(...criado());
    await p.recarregarCom([analiseDocumental, prova]);

    expect(p.edicao.aberto()).toBe(false);
    expect(p.sucessos).toHaveBeenCalledWith('Tipo de etapa criado');
    expect(p.statusDaPagina()).toBe('Tipo de etapa criado.');
  });

  it('na edição o código é somente leitura e não viaja na atualização', async () => {
    await p.abrirEdicao(analiseDocumental);
    expect(p.campo('codigo').readOnly).toBe(true);
    expect(p.campo('codigo').value).toBe('ANALISE_DOCUMENTAL');
    p.elemento<HTMLElement>('label.checkbox').click();
    const put = await p.enviar(`${ESCRITA}/${analiseDocumental.id}`);

    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: analiseDocumental.id,
      admitePontuacao: true,
      admiteEliminacao: true,
    });
    put.flush(...sucesso());
    await p.recarregarCom([analiseDocumental, prova]);
    expect(p.sucessos).toHaveBeenCalledWith('Tipo de etapa atualizado');
    expect(p.statusDaPagina()).toBe('Tipo de etapa atualizado.');
  });

  it('o ícone de editar abre a edição do tipo daquela linha', async () => {
    await p.abrirEdicao(prova);
    expect(p.campo('codigo').value).toBe('PROVA');
    expect(p.elemento('dialog[aria-label="Formulário de tipo de etapa"]').textContent).toContain(
      'Editar tipo de etapa',
    );
  });

  it('o cadastro abre em branco, admitindo os dois caracteres', async () => {
    await p.abrirEdicao(analiseDocumental);
    p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
    await p.propagar();
    p.novo().click();
    await p.propagar();
    expect(p.campo('codigo').value).toBe('');
    expect(p.campo('codigo').readOnly).toBe(false);
    expect(p.edicao.form.getRawValue()).toMatchObject({
      admitePontuacao: true,
      admiteEliminacao: true,
    });
  });

  it('cada ação mostra seu ícone e sua dica', () => {
    const editar = p.editar(analiseDocumental);
    const remover = p.remover(analiseDocumental);
    expect(editar.querySelector('i')?.className).toContain('pi-pencil');
    expect(editar.getAttribute('data-tooltip')).toBe('Editar tipo de etapa');
    expect(remover.querySelector('i')?.className).toContain('pi-trash');
    expect(remover.getAttribute('data-tooltip')).toBe('Remover tipo de etapa');
  });

  it('a confirmação nomeia a ação como remoção, e não como desativação', async () => {
    p.remover(prova).click();
    await p.propagar();

    const dialogo = p.elemento('cfg-confirmacao-de-remocao');
    expect(p.confirmar().textContent?.trim()).toBe('Remover');
    expect(dialogo.textContent).toContain('Remover tipo de etapa');
    expect(dialogo.textContent).not.toContain('Desativar');
  });

  it('o ícone de remover pede confirmação nomeando o tipo da linha, sem enviar nada', async () => {
    p.remover(prova).click();
    await p.propagar();

    expect(p.elemento('cfg-confirmacao-de-remocao').textContent).toContain('PROVA');
    p.http.expectNone(`${ESCRITA}/${prova.id}`);
    p.cancelarDaConfirmacao().click();
    await p.propagar();
    expect(p.edicao.confirmando()).toBe(false);
    p.http.expectNone(`${ESCRITA}/${prova.id}`);
  });

  it('remove após a confirmação, avisa e anuncia o desfecho na página', async () => {
    const del = await p.confirmarRemocao(prova);
    expect(del.request.method).toBe('DELETE');
    del.flush(...sucesso());
    await p.recarregarCom([analiseDocumental]);

    expect(p.edicao.confirmando()).toBe(false);
    expect(p.sucessos).toHaveBeenCalledWith('Tipo de etapa removido', 'PROVA');
    expect(p.statusDaPagina()).toBe('Tipo de etapa PROVA removido.');
  });

  it('filtra a página atual pela busca e volta à primeira ao recarregar', async () => {
    const busca = p.elemento<HTMLInputElement>('input[type="search"]');
    busca.value = 'documental';
    busca.dispatchEvent(new Event('input'));
    await p.propagar();
    expect(p.fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);

    busca.value = 'nada';
    busca.dispatchEvent(new Event('input'));
    await p.propagar();
    expect(p.fixture.nativeElement.textContent).toContain('Nenhum tipo de etapa encontrado');
  });

  it('segue pelo cursor e volta à primeira página ao recarregar', async () => {
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush([prova], {
        headers: { Link: '</api/tipos-etapa?cursor=abc&direction=next>; rel="next"' },
      });
    await p.propagar();

    p.store.proximaPagina();
    await p.propagar();
    const proxima = p.http.expectOne((r) => r.params.get('cursor') === 'abc');
    expect(proxima.request.params.get('direction')).toBe('next');
    proxima.flush([analiseDocumental]);
    await p.propagar();
    expect(p.store.tipos()).toEqual([analiseDocumental]);

    p.store.recarregar();
    await p.propagar();
    const primeira = p.http.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.has('cursor')).toBe(false);
    primeira.flush([prova]);
    await p.propagar();
    expect(p.store.tipos()).toEqual([prova]);
  });
});
