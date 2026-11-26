import { of, Subject } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { CidadeResumoDto } from '@uniplus/shared-data/geo';
import {
  errorResult,
  ligarRelogioControlado,
  mockProblemDetails,
  okResult,
  passarOTempo,
} from '@uniplus/shared-testing';
import { ESPERA_DA_DIGITACAO_MS } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CenarioDaPaginaDeUnidades,
  ESCRITA,
  belemGeo,
  criado,
  marabaGeo,
  problema,
  reitoria,
  sucesso,
} from './unidades.testing';

const cidadeEnviada = { cidadeCodigoIbge: '1504208', cidadeNome: 'Marabá', cidadeUf: 'PA' };

describe('cidade da unidade', () => {
  let p: CenarioDaPaginaDeUnidades;
  const campo = () =>
    p.elemento<HTMLInputElement>('cfg-unidade-cidade-campo input[role="combobox"]');
  const texto = () => (p.fixture.nativeElement as HTMLElement).textContent ?? '';
  const opcoes = () =>
    (p.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      'cfg-unidade-cidade-campo [role="option"]',
    );
  const tecla = (key: string) =>
    campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  beforeEach(async () => {
    ligarRelogioControlado();
    p = await CenarioDaPaginaDeUnidades.abrir();
    await p.abrirCadastro();
  });
  afterEach(() => {
    vi.useRealTimers();
    p.http.verify();
  });

  it('espera o mínimo de letras e a pausa antes de consultar uma vez', async () => {
    await p.digitarEAguardarBusca(campo(), 'Ma');
    expect(p.geo.listarCidades).not.toHaveBeenCalled();
    await p.digitar(campo(), 'Mar');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS - 1);
    expect(p.geo.listarCidades).not.toHaveBeenCalled();
    await passarOTempo(1);
    expect(p.geo.listarCidades).toHaveBeenCalledTimes(1);
    expect(p.geo.listarCidades.mock.calls[0][0].q).toBe('Mar');
  });

  it('descarta a resposta antiga e apresenta a atual', async () => {
    const antiga = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
    const atual = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
    p.geo.listarCidades.mockReturnValueOnce(antiga).mockReturnValueOnce(atual);
    await p.digitarEAguardarBusca(campo(), 'Mar');
    await p.digitarEAguardarBusca(campo(), 'Bel');
    atual.next(okResult([belemGeo]));
    antiga.next(okResult([marabaGeo]));
    await p.propagar();
    expect(texto()).toContain('Belém (PA)');
    expect(texto()).not.toContain('Marabá (PA)');
  });

  it('reabrir o cadastro recomeça a busca que falhou', async () => {
    p.geo.listarCidades.mockReturnValue(of(errorResult(mockProblemDetails({ status: 500 }))));
    const novaTentativa = () =>
      p.fixture.nativeElement.querySelector('ui-falha-de-leitura-do-campo button');
    await p.digitarEAguardarBusca(campo(), 'Mar');
    expect(novaTentativa()).not.toBeNull();
    p.edicao.fechar();
    await p.propagar();
    await p.abrirCadastro();
    expect(campo()).not.toBeNull();
    expect(novaTentativa()).toBeNull();
  });

  it('notifica falha do servidor e anuncia uma única falha junto ao campo', async () => {
    p.geo.listarCidades.mockReturnValue(of(errorResult(mockProblemDetails({ status: 500 }))));
    await p.digitarEAguardarBusca(campo(), 'Mar');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(
      p.fixture.nativeElement.querySelectorAll('ui-falha-de-leitura-do-campo [role="alert"]'),
    ).toHaveLength(1);
    expect(texto()).toContain('Não foi possível buscar os municípios');
  });

  it('tenta novamente o termo atual e devolve o foco', async () => {
    p.geo.listarCidades
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status: 500 }))))
      .mockReturnValueOnce(of(okResult([marabaGeo])));
    await p.digitarEAguardarBusca(campo(), 'Mar');
    const botao = p.elemento<HTMLButtonElement>('ui-falha-de-leitura-do-campo button');
    botao.focus();
    botao.click();
    await p.propagar();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    await p.propagar();
    expect(p.geo.listarCidades).toHaveBeenCalledTimes(2);
    expect(p.geo.listarCidades.mock.calls[1][0].q).toBe('Mar');
    expect(document.activeElement).toBe(campo());
  });

  it('escolhe pelo teclado e envia código, nome e UF', async () => {
    p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo])));
    await p.digitarEAguardarBusca(campo(), 'Mar');
    campo().focus();
    tecla('ArrowDown');
    tecla('Enter');
    await p.propagar();
    expect(p.elemento<HTMLInputElement>('#cfg-unidade-cidade-busca').value).toBe('Marabá — PA');
    const post = await p.enviar();
    expect(post.request.body).toMatchObject(cidadeEnviada);
    post.flush(...criado());
    await p.responderAConsultaDasUnidades([reitoria]);
  });

  it('associa a recusa de salvamento ao campo', async () => {
    (await p.enviar()).flush(
      ...problema(422, {
        code: 'uniplus.cidade_referencia.codigo_ibge_formato_invalido',
        title: 'Cidade inválida',
      }),
    );
    await p.propagar();
    await p.propagar();
    expect(document.activeElement).toBe(campo());
    expect(p.elemento('#cfg-unidade-cidade-erro').textContent).toContain('Cidade inválida');
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(campo().getAttribute('aria-describedby')).toContain('cfg-unidade-cidade-erro');
  });
  const trocarCidade = async () => {
    p.elemento<HTMLButtonElement>('cfg-unidade-cidade-campo .input-group button').click();
    await p.propagar();
  };
  const selecionarCidade = async () => {
    await p.digitarEAguardarBusca(campo(), 'Bel');
    campo().focus();
    tecla('ArrowDown');
    tecla('Enter');
    await p.propagar();
  };
  const recusarCidade = async () => {
    p.geo.listarCidades.mockReturnValue(of(okResult([belemGeo])));
    await selecionarCidade();
    (await p.enviar()).flush(
      ...problema(422, {
        code: 'uniplus.cidade_referencia.codigo_ibge_formato_invalido',
        title: 'Cidade inválida',
      }),
    );
    await p.propagar();
    expect(p.edicao.erroDaCidade()).toBe('Cidade inválida');
  };
  const verificarRecusaLimpa = () => {
    expect(p.edicao.erroDaCidade()).toBeNull();
    expect(p.fixture.nativeElement.querySelector('#cfg-unidade-cidade-erro')).toBeNull();
  };

  const abrirEdicaoComBuscaDeBelem = async () => {
    p.edicao.fechar();
    await p.propagar();
    p.geo.listarCidades.mockReturnValue(of(okResult([belemGeo])));
    await p.abrirEdicao(reitoria);
  };

  it('trocar a cidade na edição envia o novo trio no PUT', async () => {
    await abrirEdicaoComBuscaDeBelem();
    await trocarCidade();
    await selecionarCidade();
    const put = await p.enviar(`${ESCRITA}/${reitoria.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({
      cidadeCodigoIbge: '1501402',
      cidadeNome: 'Belém',
      cidadeUf: 'PA',
    });
    put.flush(...sucesso());
    await p.responderAConsultaDasUnidades([reitoria]);
  });

  it('reabrir a edição descarta o resíduo da busca anterior', async () => {
    await abrirEdicaoComBuscaDeBelem();
    expect(p.elemento<HTMLInputElement>('#cfg-unidade-cidade-busca').value).toBe('Marabá — PA');
    await trocarCidade();
    expect(campo().value).toBe('');
    await p.digitarEAguardarBusca(campo(), 'Bel');
    expect(Array.from(opcoes(), (opcao) => opcao.textContent?.trim())).toEqual(['Belém (PA)']);
    p.edicao.fechar();
    await p.propagar();
    await p.abrirEdicao(reitoria);
    expect(p.elemento<HTMLInputElement>('#cfg-unidade-cidade-busca').value).toBe('Marabá — PA');
    await trocarCidade();
    expect(campo().value).toBe('');
    expect(opcoes()).toHaveLength(0);
  });

  const recusaComMensagemEspecifica = () =>
    problema(422, {
      code: 'uniplus.cidade_referencia.codigo_ibge_formato_invalido',
      errors: [
        {
          field: 'cidadeCodigoIbge',
          code: 'uniplus.cidade_referencia.codigo_ibge_formato_invalido',
          message: 'Código IBGE inexistente.',
        },
      ],
    });

  it('apresenta a mensagem específica de errors[] junto ao campo', async () => {
    (await p.enviar()).flush(...recusaComMensagemEspecifica());
    await p.propagar();
    expect(p.elemento('#cfg-unidade-cidade-erro').textContent).toContain(
      'Código IBGE inexistente.',
    );
  });

  it('limpa a recusa ao trocar a cidade', async () => {
    await recusarCidade();
    await trocarCidade();
    verificarRecusaLimpa();
  });

  it('limpa a recusa ao reenviar mesmo que o servidor recuse por outro motivo', async () => {
    await recusarCidade();
    (await p.enviar()).flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    verificarRecusaLimpa();
  });

  it('limpa a recusa ao reenviar mesmo quando a validação local impede o envio', async () => {
    await recusarCidade();
    p.preencher('nome', '');
    p.edicao.salvar();
    await p.propagar();
    p.http.expectNone(ESCRITA);
    verificarRecusaLimpa();
  });
});
