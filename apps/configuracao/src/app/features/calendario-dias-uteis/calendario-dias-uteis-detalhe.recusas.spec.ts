import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DIA_ESTADUAL,
  ESCRITA_DO_DIA,
  LEITURA,
  PaginaDoDetalhe,
  calendarioCom,
  montarDetalhe,
  problema,
} from './calendario-dias-uteis.testing';

const DUPLICADA = 'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset';
const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
const CIDADE_INCOERENTE = 'uniplus.cidade_referencia.uf_incoerente';
const DESCRICAO_TAMANHO = 'uniplus.configuracao.calendario_dias_uteis.descricao_tamanho';

describe('CalendarioDiasUteisDetalhePage — recusas do servidor', () => {
  let p: PaginaDoDetalhe;

  beforeEach(async () => {
    p = await montarDetalhe([DIA_ESTADUAL]);
    await p.abrirCadastro();
    p.escrever(p.campo('descricao') as HTMLTextAreaElement, 'Data nova');
    await p.propagar();
  });
  afterEach(() => p.http.verify());

  const alerta = (): string =>
    p.fixture.nativeElement.querySelector('cfg-dia-nao-util-dialogo ui-alert')?.textContent ?? '';
  const reenviar = async () => {
    p.salvar().click();
    await p.propagar();
    return p.http.expectOne(ESCRITA_DO_DIA);
  };
  const terminar = async (requisicao: ReturnType<typeof p.http.expectOne>): Promise<void> => {
    requisicao.flush(calendarioCom([DIA_ESTADUAL]));
    await p.propagar();
    p.http.expectOne(LEITURA).flush(calendarioCom([DIA_ESTADUAL]));
    await p.propagar();
  };

  it('a data duplicada aparece no próprio formulário e diz o que ainda dá para mudar', async () => {
    const post = await p.enviar();

    post.flush(
      ...problema(422, {
        code: DUPLICADA,
        title: 'Data duplicada',
        detail: 'Data duplicada no dataset (mesma abrangência, município e UF).',
      }),
    );
    await p.propagar();

    expect(alerta()).toContain('Esta data está duplicada para a mesma abrangência e região.');
    expect(alerta()).toContain('Escolha outra abrangência ou região');
    expect(p.erros).not.toHaveBeenCalled();
    expect(p.edicao.aberto()).toBe(true);
  });

  it('a recusa apontada em campo marca o campo, leva o foco a ele e renova a chave, sem toast', async () => {
    const post = await p.enviar();
    const chave = post.request.headers.get('Idempotency-Key');

    post.flush(
      ...problema(422, {
        code: DESCRICAO_TAMANHO,
        errors: [
          {
            field: 'item.descricao',
            code: DESCRICAO_TAMANHO,
            message: 'Descrição fora do padrão.',
          },
        ],
      }),
    );
    await p.propagar();
    await p.propagar();

    expect(p.campo('descricao').getAttribute('aria-invalid')).toBe('true');
    expect(p.dialogo().textContent).toContain('Descrição fora do padrão.');
    expect(document.activeElement).toBe(p.campo('descricao'));
    expect(p.erros).not.toHaveBeenCalled();
    expect(p.dialogo().querySelector('[role="status"]')?.textContent).toContain(
      'Revise os campos indicados.',
    );
    const repeticao = await reenviar();
    expect(repeticao.request.headers.get('Idempotency-Key')).not.toBe(chave);
    await terminar(repeticao);
  });

  it('a recusa de referência de cidade cai no campo Município', async () => {
    p.escolher(p.campo('abrangencia') as HTMLSelectElement, 'MUNICIPAL');
    await p.propagar();
    await p.municipioDoDialogo();
    const post = await p.enviar();

    post.flush(
      ...problema(422, {
        code: CIDADE_INCOERENTE,
        title: 'UF incoerente',
        errors: [
          {
            field: 'item.municipioUf',
            code: CIDADE_INCOERENTE,
            message: "O prefixo do código IBGE ('15') corresponde à UF 'PA'.",
          },
        ],
      }),
    );
    await p.propagar();
    await p.propagar();

    expect(p.campo('codigoMunicipio').getAttribute('aria-invalid')).toBe('true');
    expect(p.dialogo().textContent).toContain("O prefixo do código IBGE ('15')");
    expect(document.activeElement).toBe(p.campo('codigoMunicipio'));
  });

  it('o 409 de execução em curso mantém a chave e mostra a mensagem no alerta', async () => {
    const post = await p.enviar();
    const chave = post.request.headers.get('Idempotency-Key');

    post.flush(...problema(409, { code: PROCESSANDO, title: 'Escrita em processamento' }));
    await p.propagar();

    expect(alerta()).toContain('Escrita em processamento');
    expect(p.erros).not.toHaveBeenCalled();
    const repeticao = await reenviar();
    expect(repeticao.request.headers.get('Idempotency-Key')).toBe(chave);
    await terminar(repeticao);
  });

  it.each([
    [409, 'uniplus.configuracao.calendario_dias_uteis.conflito_de_concorrencia'],
    [404, 'uniplus.configuracao.calendario_dias_uteis.nao_encontrado'],
    [422, 'uniplus.idempotency.body_mismatch'],
  ])('a recusa %s %s renova a chave e vai ao alerta, sem toast', async (status, code) => {
    const post = await p.enviar();
    const chave = post.request.headers.get('Idempotency-Key');

    post.flush(...problema(status, { code, title: 'Recusado pelo servidor' }));
    await p.propagar();

    expect(alerta()).toContain('Recusado pelo servidor');
    expect(p.erros).not.toHaveBeenCalled();
    const repeticao = await reenviar();
    expect(repeticao.request.headers.get('Idempotency-Key')).not.toBe(chave);
    await terminar(repeticao);
  });

  it('a falha do servidor mantém a chave, mostra o alerta e avisa por toast', async () => {
    const post = await p.enviar();
    const chave = post.request.headers.get('Idempotency-Key');

    post.flush(...problema(503, { code: 'uniplus.internal.unexpected', title: 'Indisponível' }));
    await p.propagar();

    expect(alerta()).toContain('Indisponível');
    expect(p.erros).toHaveBeenCalledTimes(1);
    const repeticao = await reenviar();
    expect(repeticao.request.headers.get('Idempotency-Key')).toBe(chave);
    await terminar(repeticao);
  });

  it('a recusa de um campo some da tela quando o reenvio falha por outro motivo', async () => {
    const primeira = await p.enviar();
    primeira.flush(
      ...problema(422, {
        code: DESCRICAO_TAMANHO,
        errors: [{ field: 'descricao', code: DESCRICAO_TAMANHO, message: 'Descrição recusada.' }],
      }),
    );
    await p.propagar();
    await p.propagar();
    expect(p.campo('descricao').getAttribute('aria-invalid')).toBe('true');

    p.salvar().click();
    await p.propagar();
    p.http
      .expectOne(ESCRITA_DO_DIA)
      .flush(...problema(503, { code: 'uniplus.internal.unexpected', title: 'Indisponível' }));
    await p.propagar();

    expect(p.campo('descricao').getAttribute('aria-invalid')).not.toBe('true');
    expect(p.dialogo().querySelector('.field__error')).toBeNull();
  });

  it('a recusa antiga some no início do envio seguinte', async () => {
    const primeira = await p.enviar();
    primeira.flush(
      ...problema(422, {
        code: 'uniplus.configuracao.calendario_dias_uteis.descricao_obrigatoria',
        title: 'Recusa antiga',
      }),
    );
    await p.propagar();
    expect(alerta()).toContain('Recusa antiga');

    p.salvar().click();
    await p.propagar();

    expect(alerta()).toBe('');
    await terminar(p.http.expectOne(ESCRITA_DO_DIA));
  });
});
