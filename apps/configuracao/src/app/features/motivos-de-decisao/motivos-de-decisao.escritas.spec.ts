import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  FUNDAMENTOS,
  FUNDAMENTOS_DA_API,
  Pagina,
  desativado,
  isencao,
  montarPagina,
} from './motivos-de-decisao.testing';

const SEM_CORPO = [null, { status: 204, statusText: 'No Content' }] as const;
const CRIADO = [
  '01960000-0000-7000-0000-0000000000ff',
  { status: 201, statusText: 'Created' },
] as const;
const ATIVACAO = `${ESCRITA}/${isencao.id}/ativacao`;

describe('MotivosDeDecisaoPage — escritas', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  async function abrirCadastroDeIsencao(): Promise<void> {
    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
  }

  it('criar motivo de isenção oferece os fundamentos da API e envia o tipo escolhido', async () => {
    p = await montarPagina([]);
    await abrirCadastroDeIsencao();

    expect(p.texto('select[formcontrolname="subclassificacao"]')).toContain('Baixa renda');
    p.edicao.form.setValue({
      codigo: 'RENDA_ACIMA_DO_LIMITE',
      sentido: 'DESFAVORAVEL',
      subclassificacao: 'BAIXA_RENDA',
      descricao: 'A renda supera o limite.',
    });
    p.edicao.salvar();

    const post = p.http.expectOne(ESCRITA);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toEqual({
      tipo: 'ISENCAO_DA_TAXA',
      codigo: 'RENDA_ACIMA_DO_LIMITE',
      descricao: 'A renda supera o limite.',
      subclassificacao: 'BAIXA_RENDA',
      sentido: 'DESFAVORAVEL',
    });
    post.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([isencao]);

    expect(p.edicao.aberto()).toBe(false);
    expect(p.sucessos).toHaveBeenCalledWith('Motivo de decisão criado');
  });

  it('em tipo sem subclassificação, o formulário não a mostra nem lê os fundamentos', async () => {
    p = await montarPagina([]);
    p.store.escolherTipo('CLASSIFICACAO');
    await p.propagar();
    await p.lerLista([]);

    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();

    p.http.expectNone(FUNDAMENTOS);
    expect(p.existe('select[formcontrolname="subclassificacao"]')).toBe(false);
    p.edicao.form.patchValue({
      codigo: 'NOTA_INSUFICIENTE',
      sentido: 'DESFAVORAVEL',
      descricao: 'Nota baixa.',
    });
    p.edicao.salvar();
    const post = p.http.expectOne(ESCRITA);
    expect(post.request.body).toMatchObject({ tipo: 'CLASSIFICACAO', subclassificacao: null });
    post.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([]);
  });

  it('formulário inválido não chega à API e marca os campos', async () => {
    p = await montarPagina([]);
    await abrirCadastroDeIsencao();

    p.edicao.salvar();
    await p.propagar();

    p.http.expectNone(ESCRITA);
    expect(p.edicao.form.controls.codigo.touched).toBe(true);
    expect(p.texto('cfg-motivo-de-decisao-formulario')).toContain('Código');
  });

  it('editar muda só a descrição e envia PUT sem código, sentido nem fundamento', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();

    expect(p.edicao.form.controls.codigo.disabled).toBe(true);
    const fundamento = p.elemento<HTMLSelectElement>('select[formcontrolname="subclassificacao"]');
    expect(fundamento.selectedOptions[0]?.textContent?.trim()).toBe('Baixa renda');
    expect(fundamento.disabled).toBe(true);
    p.edicao.form.controls.descricao.setValue('Renda superior ao limite do fundamento.');
    p.edicao.salvar();

    const put = p.http.expectOne(`${ESCRITA}/${isencao.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      id: isencao.id,
      descricao: 'Renda superior ao limite do fundamento.',
    });
    put.flush(...SEM_CORPO);
    await p.propagar();
    await p.lerLista([isencao]);
    expect(p.sucessos).toHaveBeenCalledWith('Motivo de decisão atualizado');
  });

  it('desativar pede confirmação, envia DELETE em ativação e recarrega a lista', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Desativar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();

    expect(p.edicao.confirmando()).toBe(true);
    expect(p.texto('cfg-confirmacao-de-remocao')).toContain('Desativar motivo de decisão?');
    p.http.expectNone(ATIVACAO);
    p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();

    const req = p.http.expectOne(ATIVACAO);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
    req.flush(...SEM_CORPO);
    await p.propagar();
    await p.lerLista([]);

    expect(p.edicao.confirmando()).toBe(false);
    expect(p.sucessos).toHaveBeenCalledWith('Motivo desativado', 'RENDA_ACIMA_DO_LIMITE');
  });

  it('reativar um desativado envia POST em ativação', async () => {
    p = await montarPagina([{ ...isencao, ativo: false }]);
    p.pelaEtiqueta('Reativar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();

    expect(p.texto('cfg-confirmacao-de-remocao')).toContain('Reativar motivo de decisão?');
    p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();

    const req = p.http.expectOne(ATIVACAO);
    expect(req.request.method).toBe('POST');
    req.flush(...SEM_CORPO);
    await p.propagar();
    await p.lerLista([isencao]);
    expect(p.sucessos).toHaveBeenCalledWith('Motivo reativado', 'RENDA_ACIMA_DO_LIMITE');
  });

  it('enquanto grava, a lista não aceita outra ação e a linha mostra o andamento', async () => {
    p = await montarPagina([isencao, desativado]);
    p.pelaEtiqueta('Desativar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    const req = p.http.expectOne(ATIVACAO);
    await p.propagar();

    expect(p.edicao.gravando()).toBe(true);
    expect(p.pelaEtiqueta('Editar motivo DOCUMENTO_ILEGIVEL').disabled).toBe(true);
    expect(p.texto('tbody tr')).toContain('Gravando...');
    p.edicao.abrirCadastro();
    expect(p.edicao.aberto()).toBe(false);

    req.flush(...SEM_CORPO);
    await p.propagar();
    await p.lerLista([desativado]);
  });

  it('enquanto salva, o botão Salvar recusa o clique e o envio repetido não chega à API', async () => {
    p = await montarPagina([]);
    await abrirCadastroDeIsencao();
    p.edicao.form.setValue({
      codigo: 'RENDA_ACIMA_DO_LIMITE',
      sentido: 'DESFAVORAVEL',
      subclassificacao: 'BAIXA_RENDA',
      descricao: 'A renda supera o limite.',
    });
    p.edicao.salvar();
    const req = p.http.expectOne(ESCRITA);
    await p.propagar();

    const botao = p.elemento<HTMLButtonElement>('button[form="cfg-motivo-de-decisao-form"]');
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    botao.dispatchEvent(clique);
    p.elemento('#cfg-motivo-de-decisao-form').dispatchEvent(new Event('submit'));

    expect(clique.defaultPrevented).toBe(true);
    expect(botao.textContent).toContain('Salvando...');
    p.http.expectNone(ESCRITA);
    req.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([isencao]);
  });

  it('enviar o formulário inválido leva o foco ao primeiro campo inválido', async () => {
    p = await montarPagina([]);
    await abrirCadastroDeIsencao();

    p.elemento('#cfg-motivo-de-decisao-form').dispatchEvent(new Event('submit'));
    await p.propagar();

    p.http.expectNone(ESCRITA);
    expect(document.activeElement).toBe(p.elemento('[formcontrolname="codigo"]'));
  });
});
