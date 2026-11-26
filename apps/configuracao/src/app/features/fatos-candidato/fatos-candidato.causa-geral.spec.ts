import { seletorDoCampo } from './seletor-do-campo.testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  LISTA,
  Pagina,
  compilarPaginaUmaVez,
  montarPagina,
  problema,
} from './fatos-candidato.testing';

const CAUSA_GERAL = {
  code: 'uniplus.configuracao.fato_candidato.bloqueado',
  message: 'O catálogo está bloqueado.',
};
const CODIGO_JA_EXISTE = 'uniplus.configuracao.fato_candidato.codigo_ja_existe';
const CRIACAO = '#cfg-fato-criacao';
const campo = (nome: string): string => seletorDoCampo(nome);

const PREENCHIMENTO_DO_DERIVADO: Record<string, string> = {
  nome: 'Perfil socioeconômico',
  descricao: 'Perfil que define a reserva de vagas.',
  codigo: 'PERFIL',
  dominio: 'SIM_OU_NAO',
  pontoResolucao: 'INSCRICAO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
};

describe('FatosCandidatoPage — causa geral na recusa da criação', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const enviarDerivado = async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await p.acionar(p.elemento('input[type="radio"][value="DERIVADO"]'));
    p.atenderApoios();
    await p.propagar();
    for (const [nome, valor] of Object.entries(PREENCHIMENTO_DO_DERIVADO)) {
      p.digitar(campo(nome), valor);
    }
    await p.propagar();
    p.submeter(CRIACAO);
    await p.propagar();
    return p.http.expectOne(`${LISTA}/derivados`);
  };

  it('o código repetido marca o campo do código e mostra a causa geral no alerta da criação', async () => {
    const pedido = await enviarDerivado();

    pedido.flush(
      ...problema(409, {
        code: CODIGO_JA_EXISTE,
        title: 'O código já existe.',
        errors: [CAUSA_GERAL],
      }),
    );
    await p.propagar();

    expect(p.elemento(campo('codigo')).getAttribute('aria-invalid')).toBe('true');
    expect(p.texto()).toContain('O catálogo está bloqueado.');
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('a recusa só de causa geral mostra a causa no lugar do título, sem marcar campo', async () => {
    const pedido = await enviarDerivado();

    pedido.flush(
      ...problema(422, {
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [CAUSA_GERAL],
      }),
    );
    await p.propagar();

    expect(p.texto()).toContain('O catálogo está bloqueado.');
    expect(p.raiz().querySelector('.field.is-error')).toBeNull();
  });

  it('a falha 5xx com causa geral mostra a causa e avisa por toast', async () => {
    const pedido = await enviarDerivado();

    pedido.flush(...problema(500, { code: 'uniplus.internal.unexpected', errors: [CAUSA_GERAL] }));
    await p.propagar();

    expect(p.texto()).toContain('O catálogo está bloqueado.');
    expect(p.erros).toHaveBeenCalledTimes(1);
  });
});
