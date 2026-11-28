import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RetificacaoEmEdicao } from '../../../retificacao/retificacao-em-edicao';
import { edicaoDasExigencias } from '../edicoes/documentos-exigidos.edicao';
import {
  adicionando,
  documentoComExigencias,
  lidas,
  reservasDe,
  secaoDe,
} from './exigencias.testing';

const chavesDasExigencias = (documento: ReturnType<typeof documentoComExigencias>) =>
  (secaoDe(documento).exigencias ?? []).map(({ chave }) => chave);

describe('edição das exigências na retificação', () => {
  function abrirRetificacao() {
    TestBed.configureTestingModule({
      providers: [RetificacaoEmEdicao, provideHttpClient(), provideHttpClientTesting()],
    });
    const retificacao = TestBed.inject(RetificacaoEmEdicao);
    const documento = documentoComExigencias();
    retificacao.abrir({ id: 'processo', versao: 1, etag: '"v1"', documento });
    return { retificacao, documento };
  }

  it('não reaproveita a chave da exigência retirada ao incluir de novo o mesmo documento', () => {
    const { retificacao, documento } = abrirRetificacao();
    const exigencias = lidas(documento);
    const aoRetirar = {
      ...exigencias,
      regrasDeComprovacao: exigencias.regrasDeComprovacao.slice(1),
    };

    retificacao.aplicar(edicaoDasExigencias(aoRetirar, reservasEm(retificacao)));
    retificacao.aplicar(edicaoDasExigencias(adicionando(aoRetirar, 'RG'), reservasEm(retificacao)));

    const chaves = chavesDasExigencias(retificacao.documento() ?? documento);
    expect(chaves).toContain('exigencia_rg_2');
    expect(chaves).not.toContain('exigencia_rg');
  });

  it('a chave criada na edição e retirada também não volta a ser usada', () => {
    const { retificacao, documento } = abrirRetificacao();
    const comNova = adicionando(lidas(documento), 'PASSAPORTE');

    retificacao.aplicar(edicaoDasExigencias(comNova, reservasEm(retificacao)));
    retificacao.aplicar(edicaoDasExigencias(lidas(documento), reservasEm(retificacao)));
    retificacao.aplicar(edicaoDasExigencias(comNova, reservasEm(retificacao)));

    expect(chavesDasExigencias(retificacao.documento() ?? documento)).toContain(
      'exigencia_passaporte_2',
    );
  });

  it('não grava nada: nenhuma requisição é feita ao editar as exigências', () => {
    const { retificacao, documento } = abrirRetificacao();

    retificacao.aplicar(
      edicaoDasExigencias(adicionando(lidas(documento), 'PASSAPORTE'), reservasEm(retificacao)),
    );

    TestBed.inject(HttpTestingController).verify();
    expect(retificacao.alterada()).toBe(true);
  });

  it('a edição sem mudança deixa a retificação sem alteração', () => {
    const { retificacao, documento } = abrirRetificacao();

    retificacao.aplicar(edicaoDasExigencias(lidas(documento), reservasEm(retificacao)));

    expect(retificacao.alterada()).toBe(false);
    expect(retificacao.documento()).toBe(documento);
  });
});

function reservasEm(retificacao: RetificacaoEmEdicao) {
  return retificacao.reservas() ?? reservasDe(documentoComExigencias());
}
