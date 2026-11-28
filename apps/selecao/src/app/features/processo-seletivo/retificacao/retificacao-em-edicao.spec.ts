import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { definirNome } from '../wizard/documento/edicoes/identificacao.edicao';
import { RetificacaoEmEdicao } from './retificacao-em-edicao';
import { baseDaRetificacao } from './retificacao.testing';

describe('RetificacaoEmEdicao', () => {
  let edicao: RetificacaoEmEdicao;
  const renomear = (nome: string) => (documento: Parameters<typeof definirNome>[0]) =>
    definirNome(documento, nome);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [RetificacaoEmEdicao] });
    edicao = TestBed.inject(RetificacaoEmEdicao);
  });

  afterEach(() => vi.restoreAllMocks());

  it('abre sobre a base, com o documento da base e sem alteração', () => {
    const base = baseDaRetificacao();

    edicao.abrir(base);

    expect(edicao.base()).toBe(base);
    expect(edicao.documento()).toBe(base.documento);
    expect(edicao.alterada()).toBe(false);
  });

  it('marca como alterada ao editar e deixa de marcar quando a edição é desfeita', () => {
    edicao.abrir(baseDaRetificacao('Medicina 2027'));

    edicao.aplicar(renomear('Medicina 2028'));
    expect(edicao.alterada()).toBe(true);
    expect(edicao.documento()?.identificacao?.nome).toBe('Medicina 2028');

    edicao.aplicar(renomear('Medicina 2027'));
    expect(edicao.alterada()).toBe(false);
  });

  it('mantém a mesma instância quando a edição não muda nada', () => {
    const base = baseDaRetificacao('Medicina 2027');
    edicao.abrir(base);

    edicao.aplicar(renomear('Medicina 2027'));

    expect(edicao.documento()).toBe(base.documento);
    expect(edicao.alterada()).toBe(false);
  });

  it('não altera o documento da base ao editar', () => {
    const base = baseDaRetificacao('Medicina 2027');
    edicao.abrir(base);

    edicao.aplicar(renomear('Medicina 2028'));

    expect(base.documento.identificacao?.nome).toBe('Medicina 2027');
  });

  it('ignora a edição quando não há base aberta', () => {
    edicao.aplicar(renomear('Medicina 2028'));

    expect(edicao.documento()).toBeNull();
    expect(edicao.alterada()).toBe(false);
  });

  it('descarta voltando à referência da base, que continua a mesma', () => {
    const base = baseDaRetificacao();
    edicao.abrir(base);
    edicao.aplicar(renomear('Medicina 2028'));

    edicao.descartar();

    expect(edicao.documento()).toBe(base.documento);
    expect(edicao.base()).toBe(base);
    expect(edicao.alterada()).toBe(false);
  });

  it('descartar sem base não faz nada', () => {
    edicao.descartar();
    expect(edicao.documento()).toBeNull();
  });

  it('fechar esquece base e documento', () => {
    edicao.abrir(baseDaRetificacao());

    edicao.fechar();

    expect(edicao.base()).toBeNull();
    expect(edicao.documento()).toBeNull();
  });

  it('não chama setItem do armazenamento ao abrir, editar e descartar', () => {
    const gravacao = vi.spyOn(Storage.prototype, 'setItem');

    edicao.abrir(baseDaRetificacao());
    edicao.aplicar(renomear('Medicina 2028'));
    edicao.descartar();

    expect(gravacao).not.toHaveBeenCalled();
  });

  it('abre com as chaves da base reservadas e nenhuma criada', () => {
    const base = baseDaRetificacao();

    edicao.abrir(base);

    expect(edicao.reservas()).toEqual({ original: base.documento, criadas: [] });
  });

  it('reserva a chave que a edição criou, mesmo depois de a parte sair', () => {
    edicao.abrir(baseDaRetificacao());
    const comParte = (documento: Parameters<typeof definirNome>[0]) =>
      ({ ...documento, etapas: [{ chave: 'etapa_redacao', nome: 'Redação' }] }) as typeof documento;
    const semParte = (documento: Parameters<typeof definirNome>[0]) =>
      ({ ...documento, etapas: [] }) as typeof documento;

    edicao.aplicar(comParte);
    edicao.aplicar(semParte);

    expect(edicao.reservas()?.criadas).toEqual(['etapa_redacao']);
  });

  it('descartar zera as chaves criadas e fechar esquece as reservas', () => {
    const base = baseDaRetificacao();
    edicao.abrir(base);
    edicao.aplicar(
      (documento) =>
        ({
          ...documento,
          etapas: [{ chave: 'etapa_redacao', nome: 'Redação' }],
        }) as typeof documento,
    );

    edicao.descartar();
    expect(edicao.reservas()).toEqual({ original: base.documento, criadas: [] });

    edicao.fechar();
    expect(edicao.reservas()).toBeNull();
  });
});
