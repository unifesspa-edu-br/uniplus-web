import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LeituraDaVersaoVigente } from './leitura-da-versao-vigente.service';
import { RetificacaoEmEdicao } from './retificacao-em-edicao';
import {
  ERRO_503,
  OUTRO_PROCESSO_ID,
  PROCESSO_ID,
  comEtag,
  documentoDaVersao,
  processoNaSituacao,
  provedoresDeLeitura,
  rotaDaConfiguracao,
  rotaDoProcesso,
} from './retificacao.testing';

const { PUBLICADO, RASCUNHO, ENCERRADO, CANCELADO } = SituacaoDoProcessoSeletivoCodigo;

describe('LeituraDaVersaoVigente', () => {
  let leitura: LeituraDaVersaoVigente;
  let edicao: RetificacaoEmEdicao;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...provedoresDeLeitura, RetificacaoEmEdicao, LeituraDaVersaoVigente],
    });
    leitura = TestBed.inject(LeituraDaVersaoVigente);
    edicao = TestBed.inject(RetificacaoEmEdicao);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function responder(id: string, situacao: SituacaoDoProcessoSeletivoCodigo, etag = '"v3"'): void {
    controller.expectOne(rotaDoProcesso(id)).flush(processoNaSituacao(id, situacao));
    controller
      .expectOne(rotaDaConfiguracao(id))
      .flush(documentoDaVersao('Medicina 2027'), comEtag(etag));
  }

  function falhar(statusDaSituacao: number, statusDaConfiguracao = statusDaSituacao): void {
    const erro = (status: number) => ({ status, statusText: 'Erro' });
    controller.expectOne(rotaDoProcesso(PROCESSO_ID)).flush(null, erro(statusDaSituacao));
    controller.expectOne(rotaDaConfiguracao(PROCESSO_ID)).flush(null, erro(statusDaConfiguracao));
  }

  it('lê a situação e a configuração juntas, só com GET, e abre a edição sobre a versão vigente', async () => {
    const lendo = leitura.ler(PROCESSO_ID);
    const situacao = controller.expectOne(rotaDoProcesso(PROCESSO_ID));
    const configuracao = controller.expectOne(rotaDaConfiguracao(PROCESSO_ID));
    expect(situacao.request.method).toBe('GET');
    expect(configuracao.request.method).toBe('GET');
    expect(configuracao.request.params.has('versao')).toBe(false);
    situacao.flush(processoNaSituacao(PROCESSO_ID, PUBLICADO));
    configuracao.flush(documentoDaVersao('Medicina 2027', 4), comEtag('"v4"'));
    await lendo;

    expect(leitura.estado().estado).toBe('aberta');
    expect(edicao.base()).toMatchObject({ id: PROCESSO_ID, versao: 4, etag: '"v4"' });
  });

  it.each([RASCUNHO, ENCERRADO, CANCELADO])(
    'processo em %s volta à consulta, sem abrir a edição',
    async (situacao) => {
      const lendo = leitura.ler(PROCESSO_ID);
      responder(PROCESSO_ID, situacao);
      await lendo;

      expect(leitura.estado().estado).toBe('voltarAConsulta');
      expect(edicao.base()).toBeNull();
    },
  );

  it('situação fora de publicado volta à consulta mesmo que a configuração seja recusada', async () => {
    const lendo = leitura.ler(PROCESSO_ID);
    controller
      .expectOne(rotaDoProcesso(PROCESSO_ID))
      .flush(processoNaSituacao(PROCESSO_ID, RASCUNHO));
    controller
      .expectOne(rotaDaConfiguracao(PROCESSO_ID))
      .flush(null, { status: 404, statusText: 'x' });
    await lendo;

    expect(leitura.estado().estado).toBe('voltarAConsulta');
  });

  it.each([
    [403, 'semPermissao'],
    [404, 'naoEncontrado'],
    [503, 'falhaTemporaria'],
  ])('a resposta %i vira o motivo %s', async (status, motivo) => {
    const lendo = leitura.ler(PROCESSO_ID);
    falhar(status);
    await lendo;

    expect(leitura.estado()).toMatchObject({ estado: 'falha', motivo });
    expect(edicao.base()).toBeNull();
  });

  it('falha só na configuração também é falha de leitura', async () => {
    const lendo = leitura.ler(PROCESSO_ID);
    controller
      .expectOne(rotaDoProcesso(PROCESSO_ID))
      .flush(processoNaSituacao(PROCESSO_ID, PUBLICADO));
    controller.expectOne(rotaDaConfiguracao(PROCESSO_ID)).flush(null, ERRO_503);
    await lendo;

    expect(leitura.estado()).toMatchObject({ estado: 'falha', motivo: 'falhaTemporaria' });
  });

  it('configuração sem ETag é falha que admite repetir', async () => {
    const lendo = leitura.ler(PROCESSO_ID);
    controller
      .expectOne(rotaDoProcesso(PROCESSO_ID))
      .flush(processoNaSituacao(PROCESSO_ID, PUBLICADO));
    controller.expectOne(rotaDaConfiguracao(PROCESSO_ID)).flush(documentoDaVersao('Medicina 2027'));
    await lendo;

    expect(leitura.estado()).toMatchObject({ estado: 'falha', motivo: 'falhaTemporaria' });
    expect(edicao.base()).toBeNull();
  });

  it('identificador malformado falha sem chamar a API', async () => {
    await leitura.ler('novo');

    expect(leitura.estado()).toMatchObject({ estado: 'falha', motivo: 'idInvalido' });
  });

  it('descarta a resposta de um processo anterior que chega depois da do atual', async () => {
    const primeira = leitura.ler(PROCESSO_ID);
    const segunda = leitura.ler(OUTRO_PROCESSO_ID);

    responder(OUTRO_PROCESSO_ID, PUBLICADO, '"do-outro"');
    await segunda;
    responder(PROCESSO_ID, RASCUNHO);
    await primeira;

    expect(leitura.estado()).toMatchObject({
      estado: 'aberta',
      processo: { id: OUTRO_PROCESSO_ID },
    });
    expect(edicao.base()?.etag).toBe('"do-outro"');
  });

  it('esquece a edição do processo anterior ao começar outra leitura', async () => {
    const primeira = leitura.ler(PROCESSO_ID);
    responder(PROCESSO_ID, PUBLICADO);
    await primeira;
    expect(edicao.base()).not.toBeNull();

    const segunda = leitura.ler(OUTRO_PROCESSO_ID);
    expect(edicao.base()).toBeNull();
    expect(leitura.estado().estado).toBe('lendo');
    responder(OUTRO_PROCESSO_ID, PUBLICADO);
    await segunda;
  });

  it('recarregar repete a leitura do mesmo processo', async () => {
    const primeira = leitura.ler(PROCESSO_ID);
    falhar(503);
    await primeira;

    const repetida = leitura.recarregar();
    responder(PROCESSO_ID, PUBLICADO);
    await repetida;

    expect(leitura.estado().estado).toBe('aberta');
  });

  it('recarregar sem leitura anterior não chama a API', async () => {
    await leitura.recarregar();
    expect(leitura.estado().estado).toBe('lendo');
  });
});
