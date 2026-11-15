import { TestBed } from '@angular/core/testing';

import { MotivoDoAcessoNegadoService } from './motivo-do-acesso-negado.service';

describe('MotivoDoAcessoNegadoService', () => {
  function criar(): MotivoDoAcessoNegadoService {
    TestBed.resetTestingModule();
    return TestBed.inject(MotivoDoAcessoNegadoService);
  }

  it('começa sem motivo', () => {
    expect(criar().motivo()).toBeNull();
  });

  it('guarda o detail registrado, sem espaços nas pontas', () => {
    const servico = criar();

    servico.registrar('  Falta a permissão de manter perfis.  ');

    expect(servico.motivo()).toBe('Falta a permissão de manter perfis.');
  });

  it.each([undefined, '', '   ', 42, { a: 1 }])('detail %j não deixa motivo', (detail) => {
    const servico = criar();
    servico.registrar('Motivo anterior.');

    servico.registrar(detail);

    expect(servico.motivo()).toBeNull();
  });

  it('limpar remove o motivo', () => {
    const servico = criar();
    servico.registrar('Motivo.');

    servico.limpar();

    expect(servico.motivo()).toBeNull();
  });
});
