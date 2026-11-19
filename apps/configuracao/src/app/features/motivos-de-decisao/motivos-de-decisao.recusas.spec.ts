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

const ATIVACAO = `${ESCRITA}/${isencao.id}/ativacao`;
const valido = {
  codigo: 'RENDA_ACIMA_DO_LIMITE',
  sentido: 'DESFAVORAVEL',
  subclassificacao: 'BAIXA_RENDA',
  descricao: 'A renda supera o limite.',
};

describe('MotivosDeDecisaoPage — recusas', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  async function enviarCriacao() {
    p.edicao.form.setValue(valido);
    p.edicao.salvar();
    await p.propagar();
    return p.http.expectOne(ESCRITA);
  }

  async function abrirCadastro(): Promise<void> {
    p = await montarPagina([]);
    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
  }

  it('código que já existe é recusado no campo, sem fechar o formulário', async () => {
    await abrirCadastro();
    (await enviarCriacao()).flush(
      ...problema(409, { code: 'uniplus.selecao.motivo_de_decisao.codigo_ja_existe' }),
    );
    await p.propagar();

    expect(p.edicao.aberto()).toBe(true);
    expect(p.edicao.form.controls.codigo.errors).not.toBeNull();
    const mensagem = p.texto('#cfg-motivo-codigo-erro');
    expect(mensagem.length).toBeGreaterThan(0);
    expect(mensagem).not.toContain('Imutável');
    expect(p.elemento('[formcontrolname="codigo"]').getAttribute('aria-describedby')).toContain(
      'cfg-motivo-codigo-erro',
    );
    expect(p.edicao.salvando()).toBe(false);
  });

  it('a recusa de campo da API aparece no controle e o reenvio usa nova chave de idempotência', async () => {
    await abrirCadastro();
    const primeira = await enviarCriacao();
    const chave = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'Subclassificacao',
            code: 'uniplus.selecao.motivo_de_decisao.subclassificacao_obrigatoria',
            message: 'Informe o fundamento.',
          },
        ],
      }),
    );
    await p.propagar();

    expect(p.edicao.form.controls.subclassificacao.errors).not.toBeNull();
    p.edicao.form.controls.subclassificacao.setValue('DOADOR_DE_MEDULA');
    const segunda = await enviarCriacao();
    expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
    segunda.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
  });

  it('recusa sem campo conhecido vira mensagem do formulário', async () => {
    await abrirCadastro();
    (await enviarCriacao()).flush(
      ...problema(422, {
        code: 'uniplus.validacao',
        errors: [{ field: 'Desconhecido', code: 'x', message: 'Valor inválido.' }],
      }),
    );
    await p.propagar();

    expect(p.edicao.erro()).not.toBeNull();
    expect(p.texto('cfg-motivo-de-decisao-formulario')).toContain('Não foi possível salvar');
  });

  it('falha do servidor na criação mantém o formulário aberto e avisa', async () => {
    await abrirCadastro();
    (await enviarCriacao()).flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.edicao.aberto()).toBe(true);
    expect(p.edicao.erro()).not.toBeNull();
    expect(p.erros).toHaveBeenCalled();
  });

  it('falha ao ler os fundamentos aparece no campo e a leitura é refeita na próxima abertura', async () => {
    p = await montarPagina([]);
    p.elemento<HTMLButtonElement>('#cfg-motivos-de-decisao-novo').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.edicao.falhaNosFundamentos()).not.toBeNull();
    expect(p.texto('cfg-motivo-de-decisao-formulario')).toContain(
      p.edicao.falhaNosFundamentos() as string,
    );

    p.edicao.fechar();
    p.edicao.abrirCadastro();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(FUNDAMENTOS_DA_API);
    await p.propagar();
    expect(p.edicao.falhaNosFundamentos()).toBeNull();
    expect(p.edicao.fundamentos()).toHaveLength(2);
  });

  it('recusa da desativação fica no diálogo, que segue aberto para nova tentativa', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Desativar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    const primeira = p.http.expectOne(ATIVACAO);
    const chave = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(
      ...problema(422, { code: 'uniplus.selecao.motivo_de_decisao.cobertura_insuficiente' }),
    );
    await p.propagar();

    expect(p.edicao.confirmando()).toBe(true);
    expect(p.edicao.erroDaConfirmacao()).not.toBeNull();
    expect(p.edicao.mudandoSituacao()).toBe(false);

    p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    const segunda = p.http.expectOne(ATIVACAO);
    expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
    segunda.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    expect(p.erros).toHaveBeenCalled();
  });

  it.each([
    { acao: 'Desativar', motivo: isencao },
    { acao: 'Reativar', motivo: { ...isencao, ativo: false } },
  ])(
    '$acao com falha do servidor, mesmo fechando e reabrindo a confirmação, reenvia com a mesma chave',
    async ({ acao, motivo }) => {
      p = await montarPagina([motivo]);
      const falhar = async (): Promise<string | null> => {
        p.pelaEtiqueta(`${acao} motivo RENDA_ACIMA_DO_LIMITE`).click();
        await p.propagar();
        p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
        const req = p.http.expectOne(ATIVACAO);
        req.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
        await p.propagar();
        return req.request.headers.get('Idempotency-Key');
      };

      const primeira = await falhar();
      p.edicao.confirmando.set(false);
      await p.propagar();
      const segunda = await falhar();

      expect(primeira).toBeTruthy();
      expect(segunda).toBe(primeira);
    },
  );

  it('a confirmação de outro motivo nunca reaproveita a chave da anterior', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Desativar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    const primeira = p.http.expectOne(ATIVACAO);
    primeira.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    p.edicao.confirmando.set(false);
    p.edicao.pedirMudancaDeSituacao({ ...isencao, id: 'outro-motivo' }, false);
    p.edicao.confirmarMudanca();
    const outra = p.http.expectOne(`${ESCRITA}/outro-motivo/ativacao`);
    expect(outra.request.headers.get('Idempotency-Key')).not.toBe(
      primeira.request.headers.get('Idempotency-Key'),
    );
    outra.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
  });

  it('na edição, o fundamento do motivo continua visível mesmo sem o catálogo', async () => {
    p = await montarPagina([isencao]);
    p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE').click();
    await p.propagar();
    p.http.expectOne(FUNDAMENTOS).flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    const fundamento = p.elemento<HTMLSelectElement>('select[formcontrolname="subclassificacao"]');
    expect(fundamento.selectedOptions[0]?.textContent?.trim()).toBe('BAIXA_RENDA');
    expect(p.existe('#cfg-motivo-fundamentos-falha')).toBe(false);
  });

  it('cada campo recusado se liga à sua mensagem por aria-describedby', async () => {
    await abrirCadastro();
    p.edicao.salvar();
    await p.propagar();

    const codigo = p.elemento('[formcontrolname="codigo"]');
    const ligados = (codigo.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ligados).toContain('cfg-motivo-codigo-erro');
    expect(ligados.every((id) => p.existe(`#${id}`))).toBe(true);
    const descricao = p.elemento('[formcontrolname="descricao"]');
    expect(descricao.getAttribute('aria-describedby')).toBe('cfg-motivo-descricao-erro');
    expect(p.existe('#cfg-motivo-descricao-erro')).toBe(true);
  });

  it('fechar o formulário durante o envio não o fecha, e cancelar depois fecha', async () => {
    await abrirCadastro();
    const req = await enviarCriacao();

    p.edicao.fechar();
    expect(p.edicao.aberto()).toBe(true);
    req.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    p.edicao.fechar();
    expect(p.edicao.aberto()).toBe(false);
  });
});
