import { describe, expect, it } from 'vitest';

import { documentoDaVersao, PROCESSO_ID, respostaComEtag } from './retificacao.testing';
import { versaoBaseDaResposta } from './versao-base-da-retificacao';

describe('versaoBaseDaResposta', () => {
  it('guarda o ETag como veio e toma a versão do documento', () => {
    const documento = documentoDaVersao('Medicina 2027', 5);

    const base = versaoBaseDaResposta(PROCESSO_ID, respostaComEtag(documento, 'W/"abc"'));

    expect(base).toEqual({ id: PROCESSO_ID, versao: 5, etag: 'W/"abc"', documento });
    expect(base?.documento).toBe(documento);
  });

  it('trata resposta sem ETag como falha', () => {
    const resposta = respostaComEtag(documentoDaVersao('Medicina 2027'), null);
    expect(versaoBaseDaResposta(PROCESSO_ID, resposta)).toBeNull();
  });

  it('trata ETag vazio como falha', () => {
    const resposta = respostaComEtag(documentoDaVersao('Medicina 2027'), '');
    expect(versaoBaseDaResposta(PROCESSO_ID, resposta)).toBeNull();
  });

  it('trata documento sem número de versão como falha', () => {
    const semVersao = { ...documentoDaVersao('Medicina 2027'), versao: undefined };
    expect(versaoBaseDaResposta(PROCESSO_ID, respostaComEtag(semVersao, '"x"'))).toBeNull();
  });
});
