import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  FUNDAMENTOS,
  FUNDAMENTOS_DA_API,
  Pagina,
  isencao,
  montarPagina,
  problema,
} from './motivos-de-decisao.testing';

const FALHA_AMBIGUA = problema(503, { code: 'uniplus.internal.unexpected' });
const SEM_CORPO = [null, { status: 204, statusText: 'No Content' }] as const;
const CRIADO = [
  '01960000-0000-7000-0000-0000000000ff',
  { status: 201, statusText: 'Created' },
] as const;
const valido = {
  codigo: 'RENDA_ACIMA_DO_LIMITE',
  sentido: 'DESFAVORAVEL',
  subclassificacao: 'BAIXA_RENDA',
  descricao: 'A renda supera o limite.',
};

describe('MotivosDeDecisaoPage — reenvio após falha sem resposta conclusiva', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  async function abrirCadastro(): Promise<void> {
    p = await montarPagina([]);
    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
  }

  async function enviar() {
    p.edicao.salvar();
    await p.propagar();
    return p.http.expectOne(ESCRITA);
  }

  async function criarComFalhaAmbigua(): Promise<string | null> {
    await abrirCadastro();
    p.edicao.form.setValue(valido);
    const primeira = await enviar();
    primeira.flush(...FALHA_AMBIGUA);
    await p.propagar();
    return primeira.request.headers.get('Idempotency-Key');
  }

  it('trava os campos e só reenvia o mesmo comando, com a mesma chave', async () => {
    const chave = await criarComFalhaAmbigua();

    expect(chave).toBeTruthy();
    expect(p.edicao.aguardandoReenvio()).toBe(true);
    expect(p.texto('cfg-motivo-de-decisao-formulario [role="status"]')).toContain(
      'Envio sem confirmação',
    );
    expect(p.elemento<HTMLInputElement>('[formcontrolname="codigo"]').disabled).toBe(true);
    expect(p.elemento<HTMLTextAreaElement>('[formcontrolname="descricao"]').disabled).toBe(true);
    expect(p.texto('cfg-motivo-de-decisao-formulario')).toContain('Envio sem confirmação');

    p.elemento<HTMLButtonElement>('button[form="cfg-motivo-de-decisao-form"]').click();
    await p.propagar();
    const reenvio = p.http.expectOne(ESCRITA);
    expect(reenvio.request.headers.get('Idempotency-Key')).toBe(chave);
    expect(reenvio.request.body).toEqual({
      tipo: 'ISENCAO_DA_TAXA',
      codigo: valido.codigo,
      descricao: valido.descricao,
      subclassificacao: valido.subclassificacao,
      sentido: valido.sentido,
    });
    reenvio.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([isencao]);

    expect(p.edicao.aberto()).toBe(false);
    expect(p.edicao.aguardandoReenvio()).toBe(false);
  });

  it('na edição, o reenvio leva o mesmo PUT com a mesma chave', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
    p.edicao.form.controls.descricao.setValue('Renda superior ao limite do fundamento.');
    p.edicao.salvar();
    const primeira = p.http.expectOne(`${ESCRITA}/${isencao.id}`);
    primeira.flush(...FALHA_AMBIGUA);
    await p.propagar();

    expect(p.elemento<HTMLTextAreaElement>('[formcontrolname="descricao"]').disabled).toBe(true);
    p.edicao.salvar();
    const reenvio = p.http.expectOne(`${ESCRITA}/${isencao.id}`);
    expect(reenvio.request.headers.get('Idempotency-Key')).toBe(
      primeira.request.headers.get('Idempotency-Key'),
    );
    expect(reenvio.request.body).toEqual(primeira.request.body);
    reenvio.flush(...SEM_CORPO);
    await p.propagar();
    await p.lerLista([isencao]);
  });

  it('descartar o envio pendente libera um formulário novo, com chave nova', async () => {
    const chave = await criarComFalhaAmbigua();

    p.edicao.fechar();
    await p.propagar();
    await p.lerLista([isencao]);
    p.edicao.abrirCadastro();
    await p.propagar();

    expect(chave).toBeTruthy();
    expect(p.edicao.aguardandoReenvio()).toBe(false);
    expect(p.elemento<HTMLInputElement>('[formcontrolname="codigo"]').disabled).toBe(false);
    expect(p.elemento<HTMLTextAreaElement>('[formcontrolname="descricao"]').disabled).toBe(false);
    p.edicao.form.setValue({ ...valido, descricao: 'Descrição diferente da anterior.' });
    const nova = await enviar();
    expect(nova.request.headers.get('Idempotency-Key')).not.toBe(chave);
    nova.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([isencao]);
  });

  it('recusa definitiva do reenvio libera os campos, e a edição válida sai com chave nova', async () => {
    const chave = await criarComFalhaAmbigua();

    const reenvio = await enviar();
    reenvio.flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        errors: [{ field: 'Descricao', code: 'uniplus.x', message: 'Descrição recusada.' }],
      }),
    );
    await p.propagar();

    expect(p.edicao.aguardandoReenvio()).toBe(false);
    expect(p.elemento<HTMLTextAreaElement>('[formcontrolname="descricao"]').disabled).toBe(false);
    p.edicao.form.controls.descricao.setValue('Descrição corrigida pela pessoa.');
    const corrigido = await enviar();
    expect(chave).toBeTruthy();
    expect(corrigido.request.headers.get('Idempotency-Key')).not.toBe(chave);
    expect(corrigido.request.body).toMatchObject({ descricao: 'Descrição corrigida pela pessoa.' });
    corrigido.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([isencao]);
  });

  it.each([
    {
      nome: 'erro de rede',
      falhar: (r: ReturnType<Pagina['http']['expectOne']>) => r.error(new ProgressEvent('error')),
    },
    {
      nome: 'envio ainda em processamento no servidor',
      falhar: (r: ReturnType<Pagina['http']['expectOne']>) =>
        r.flush(...problema(409, { code: 'uniplus.idempotency.processing_conflict' })),
    },
  ])('$nome também trava o formulário para reenviar o mesmo comando', async ({ falhar }) => {
    await abrirCadastro();
    p.edicao.form.setValue(valido);
    const primeira = await enviar();
    falhar(primeira);
    await p.propagar();

    expect(p.edicao.aguardandoReenvio()).toBe(true);
    const reenvio = await enviar();
    expect(primeira.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(reenvio.request.headers.get('Idempotency-Key')).toBe(
      primeira.request.headers.get('Idempotency-Key'),
    );
    reenvio.flush(...CRIADO);
    await p.propagar();
    await p.lerLista([isencao]);
  });

  it('código já existente no reenvio libera os campos e marca o código', async () => {
    await criarComFalhaAmbigua();

    (await enviar()).flush(
      ...problema(409, { code: 'uniplus.selecao.motivo_de_decisao.codigo_ja_existe' }),
    );
    await p.propagar();

    expect(p.edicao.aguardandoReenvio()).toBe(false);
    expect(p.edicao.form.controls.codigo.enabled).toBe(true);
    expect(p.edicao.form.controls.codigo.errors).not.toBeNull();
    expect(p.edicao.form.controls.subclassificacao.enabled).toBe(true);
  });

  it('em tipo sem subclassificação, liberar não habilita a subclassificação', async () => {
    p = await montarPagina([]);
    p.store.escolherTipo('CLASSIFICACAO');
    await p.propagar();
    await p.lerLista([]);
    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();
    p.edicao.form.patchValue({
      codigo: 'NOTA_INSUFICIENTE',
      sentido: 'DESFAVORAVEL',
      descricao: 'Nota baixa.',
    });
    (await enviar()).flush(...FALHA_AMBIGUA);
    await p.propagar();

    (await enviar()).flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        errors: [{ field: 'Codigo', code: 'x', message: 'Recusado.' }],
      }),
    );
    await p.propagar();

    expect(p.edicao.form.controls.codigo.enabled).toBe(true);
    expect(p.edicao.form.controls.descricao.enabled).toBe(true);
    expect(p.edicao.form.controls.subclassificacao.disabled).toBe(true);
  });

  it('na edição, a recusa definitiva do reenvio libera só a descrição', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
    p.edicao.salvar();
    p.http.expectOne(`${ESCRITA}/${isencao.id}`).flush(...FALHA_AMBIGUA);
    await p.propagar();

    p.edicao.salvar();
    p.http.expectOne(`${ESCRITA}/${isencao.id}`).flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        errors: [{ field: 'Descricao', code: 'x', message: 'Recusada.' }],
      }),
    );
    await p.propagar();

    expect(p.edicao.form.controls.descricao.enabled).toBe(true);
    expect(p.edicao.form.controls.codigo.disabled).toBe(true);
    expect(p.edicao.form.controls.sentido.disabled).toBe(true);
    expect(p.edicao.form.controls.subclassificacao.disabled).toBe(true);
  });

  describe.each([
    {
      como: 'o X da gaveta',
      fechar: () => p.elemento<HTMLButtonElement>('ui-drawer button[aria-label="Fechar"]').click(),
    },
    {
      como: 'o Esc',
      fechar: () =>
        p
          .elemento<HTMLDialogElement>('ui-drawer dialog')
          .dispatchEvent(new Event('cancel', { cancelable: true })),
    },
  ])('descartar o envio pendente por $como', ({ fechar }) => {
    it('relê a lista, libera o formulário e o reabre com a descrição atual', async () => {
      p = await montarPagina([isencao]);
      p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
      await p.propagar();
      p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
      await p.propagar();
      p.edicao.form.controls.descricao.setValue('Descrição enviada sem resposta.');
      p.edicao.salvar();
      p.http.expectOne(`${ESCRITA}/${isencao.id}`).flush(...FALHA_AMBIGUA);
      await p.propagar();
      expect(p.edicao.aguardandoReenvio()).toBe(true);

      fechar();
      await p.propagar();
      await p.lerLista([{ ...isencao, descricao: 'Descrição já gravada no servidor.' }]);

      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.aguardandoReenvio()).toBe(false);
      p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
      await p.propagar();
      expect(p.edicao.form.controls.descricao.value).toBe('Descrição já gravada no servidor.');
      expect(p.edicao.form.controls.descricao.enabled).toBe(true);
    });
  });
});
