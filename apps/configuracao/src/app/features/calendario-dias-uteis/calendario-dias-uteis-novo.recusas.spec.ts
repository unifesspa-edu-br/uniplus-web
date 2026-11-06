import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA_DO_CALENDARIO,
  PaginaNova,
  criado,
  montarNovo,
  problema,
} from './calendario-dias-uteis.testing';

const DUPLICADA = 'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset';
const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
const CIDADE_INCOERENTE = 'uniplus.cidade_referencia.uf_incoerente';
const CODIGOS = 'uniplus.configuracao.calendario_dias_uteis';
const DESCRICAO_TAMANHO = `${CODIGOS}.descricao_tamanho`;
const VERSAO_TAMANHO = `${CODIGOS}.versao_dataset_tamanho`;
const DATA_AUSENTE = `${CODIGOS}.data_ausente`;
const SEM_DIA_NAO_UTIL = `${CODIGOS}.sem_dia_nao_util`;

/** Como a API recusa campos: a primeira violação dá o código da raiz, e cada uma vai em `errors[]`. */
const recusaDeCampo = (field: string, code: string, message: string) =>
  problema(422, { code, errors: [{ field, code, message }] });

describe('CalendarioDiasUteisNovoPage — recusas do servidor', () => {
  let p: PaginaNova;

  beforeEach(async () => {
    p = await montarNovo();
    p.escrever(p.versao(), '2026.1');
  });
  afterEach(() => p.http.verify());

  const chaveDe = (requisicao: { request: { headers: { get(n: string): string | null } } }) =>
    requisicao.request.headers.get('Idempotency-Key');
  const diaNacional = async (data = '2026-09-07'): Promise<number> => {
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'NACIONAL', data);
    return indice;
  };
  const reenviar = async () => {
    p.salvar().click();
    await p.propagar();
    return p.http.expectOne(ESCRITA_DO_CALENDARIO);
  };

  describe('recusa apontada em campo', () => {
    it('marca o campo recusado, leva o foco a ele e renova a chave, sem toast', async () => {
      await diaNacional();
      const post = await p.enviar();
      const chave = chaveDe(post);

      post.flush(
        ...recusaDeCampo(
          'diasNaoUteis[0].descricao',
          DESCRICAO_TAMANHO,
          'Descrição fora do padrão.',
        ),
      );
      await p.propagar();
      await p.propagar();

      const descricao = p.dia(0, 'descricao');
      expect(descricao.getAttribute('aria-invalid')).toBe('true');
      expect(p.fixture.nativeElement.textContent).toContain('Descrição fora do padrão.');
      expect(document.activeElement).toBe(descricao);
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.elemento('[role="status"]').textContent).toContain('Revise os campos indicados.');

      const repeticao = await reenviar();
      expect(chaveDe(repeticao)).not.toBe(chave);
      repeticao.flush(...criado());
      await p.fixture.whenStable();
    });

    it('a recusa da versão do dataset aparece no campo da versão', async () => {
      await diaNacional();
      const post = await p.enviar();

      post.flush(...recusaDeCampo('versaoDataset', VERSAO_TAMANHO, 'Versão fora do padrão.'));
      await p.propagar();
      await p.propagar();

      expect(p.versao().getAttribute('aria-invalid')).toBe('true');
      expect(p.fixture.nativeElement.textContent).toContain('Versão fora do padrão.');
      expect(document.activeElement).toBe(p.versao());
    });

    it('a recusa do dia certo cai na linha indicada pela posição', async () => {
      await diaNacional('2026-09-07');
      await diaNacional('2026-10-12');
      const post = await p.enviar();

      post.flush(...recusaDeCampo('diasNaoUteis[1].data', DATA_AUSENTE, 'Data inválida.'));
      await p.propagar();
      await p.propagar();

      expect(p.dia(0, 'data').getAttribute('aria-invalid')).toBeNull();
      expect(p.dia(1, 'data').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.dia(1, 'data'));
    });

    it('uma recusa sem campo na tela vai ao alerta', async () => {
      await diaNacional();
      const post = await p.enviar();

      post.flush(...recusaDeCampo('diasNaoUteis', SEM_DIA_NAO_UTIL, 'Ao menos um dia.'));
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Falha');
    });
  });

  describe('chave de idempotência', () => {
    it('o 409 de execução em curso mantém a chave e mostra a mensagem no alerta', async () => {
      await diaNacional();
      const post = await p.enviar();
      const chave = chaveDe(post);

      post.flush(...problema(409, { code: PROCESSANDO, title: 'Escrita em processamento' }));
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Escrita em processamento');
      expect(p.erros).not.toHaveBeenCalled();
      const repeticao = await reenviar();
      expect(chaveDe(repeticao)).toBe(chave);
      repeticao.flush(...criado());
      await p.fixture.whenStable();
    });

    it.each([
      [422, 'uniplus.idempotency.body_mismatch'],
      [404, 'uniplus.configuracao.calendario_dias_uteis.nao_encontrado'],
    ])('a recusa %s %s renova a chave e vai ao alerta, sem toast', async (status, code) => {
      await diaNacional();
      const post = await p.enviar();
      const chave = chaveDe(post);

      post.flush(...problema(status, { code, title: 'Recusado pelo servidor' }));
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Recusado pelo servidor');
      expect(p.erros).not.toHaveBeenCalled();
      const repeticao = await reenviar();
      expect(chaveDe(repeticao)).not.toBe(chave);
      repeticao.flush(...criado());
      await p.fixture.whenStable();
    });

    it('a falha do servidor mantém a chave, mostra o alerta e avisa por toast', async () => {
      await diaNacional();
      const post = await p.enviar();
      const chave = chaveDe(post);

      post.flush(...problema(503, { code: 'uniplus.indisponivel', title: 'Indisponível' }));
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Indisponível');
      expect(p.erros).toHaveBeenCalledTimes(1);
      const repeticao = await reenviar();
      expect(chaveDe(repeticao)).toBe(chave);
      repeticao.flush(...criado());
      await p.fixture.whenStable();
    });
  });

  describe('recusa da referência de cidade', () => {
    it('cai no campo Município da linha que o servidor aponta, não na outra municipal', async () => {
      const linhas: number[] = [];
      for (const data of ['2026-04-05', '2026-06-12']) {
        const indice = await p.adicionarDia();
        await p.preencherDia(indice, 'MUNICIPAL', data);
        await p.municipioDoDia(indice);
        linhas.push(indice);
      }
      const post = await p.enviar();

      post.flush(
        ...problema(422, {
          code: CIDADE_INCOERENTE,
          title: 'UF incoerente',
          errors: [
            {
              field: 'diasNaoUteis[1].municipioUf',
              code: CIDADE_INCOERENTE,
              message: "O prefixo do código IBGE ('15') corresponde à UF 'PA'.",
            },
          ],
        }),
      );
      await p.propagar();
      await p.propagar();

      expect(p.dia(linhas[0], 'codigo-municipio').getAttribute('aria-invalid')).toBeNull();
      expect(p.dia(linhas[1], 'codigo-municipio').getAttribute('aria-invalid')).toBe('true');
      expect(p.fixture.nativeElement.textContent).toContain("O prefixo do código IBGE ('15')");
      expect(document.activeElement).toBe(p.dia(linhas[1], 'codigo-municipio'));
    });
  });

  describe('recusas sem campo próprio', () => {
    it('a data duplicada no servidor vai ao alerta, sem toast', async () => {
      await diaNacional('2026-09-07');
      await diaNacional('2026-09-08');
      const post = await p.enviar();

      post.flush(
        ...problema(422, {
          code: DUPLICADA,
          title: 'Data duplicada',
          detail: 'Data duplicada no dataset: 2026-09-08.',
        }),
      );
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Data duplicada');
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
