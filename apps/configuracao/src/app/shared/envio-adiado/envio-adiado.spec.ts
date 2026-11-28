import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { adiarEnvioEnquantoPendente } from './envio-adiado';

describe('adiarEnvioEnquantoPendente', () => {
  const AVISO = 'Aguarde as opções carregarem para enviar.';
  const pendente = signal(false);

  function criar() {
    return TestBed.runInInjectionContext(() => adiarEnvioEnquantoPendente(pendente, AVISO));
  }

  beforeEach(() => pendente.set(false));

  it('não adia nem avisa quando a leitura já terminou', () => {
    const envio = criar();

    expect(envio.adiarSePendente()).toBe(false);
    expect(envio.mensagem()).toBe('');
  });

  it('adia o envio pedido durante a leitura e mostra o aviso', () => {
    pendente.set(true);
    const envio = criar();

    expect(envio.adiarSePendente()).toBe(true);
    expect(envio.mensagem()).toBe(AVISO);
  });

  it('não mostra o aviso enquanto ninguém pediu o envio', () => {
    pendente.set(true);

    expect(criar().mensagem()).toBe('');
  });

  it('retira o aviso quando a leitura termina e não o repete numa leitura nova sem pedido', () => {
    pendente.set(true);
    const envio = criar();
    envio.adiarSePendente();

    pendente.set(false);
    expect(envio.mensagem()).toBe('');
    pendente.set(true);

    expect(envio.mensagem()).toBe('');
  });

  it('não repete o aviso quando a leitura termina e recomeça antes de qualquer leitura do aviso', () => {
    pendente.set(true);
    const envio = criar();
    envio.adiarSePendente();

    pendente.set(false);
    pendente.set(true);

    expect(envio.mensagem()).toBe('');
  });
});
