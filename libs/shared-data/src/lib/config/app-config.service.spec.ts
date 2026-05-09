import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { AppConfigService } from './app-config.service';
import type { AppConfig } from './app-config.model';

const sampleConfig: AppConfig = {
  apiUrl: 'http://localhost:5000',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'unifesspa',
    clientId: 'selecao-web',
  },
};

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppConfigService);
  });

  it('lança ao chamar get() antes de load() — força bootstrap order visível', () => {
    expect(() => service.get()).toThrow(/runtime-config carregar/);
  });

  it('expõe a config após load()', () => {
    service.load(sampleConfig);
    expect(service.get()).toEqual(sampleConfig);
  });

  it('signal `config()` é null antes do load e populado após', () => {
    expect(service.config()).toBeNull();
    service.load(sampleConfig);
    expect(service.config()).toEqual(sampleConfig);
  });

  it('load() sobrescreve a config anterior (idempotente para mesmo valor)', () => {
    service.load(sampleConfig);
    const novo: AppConfig = { ...sampleConfig, apiUrl: 'http://api.hml.example.com' };
    service.load(novo);
    expect(service.get().apiUrl).toBe('http://api.hml.example.com');
  });
});
