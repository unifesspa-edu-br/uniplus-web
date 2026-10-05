import { ApplicationRef } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CertameDocumentosComponent } from './certame-documentos';

const BASE = 'http://localhost:5000';
const CERTAME_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_CERTAME = `${BASE}/api/selecao/certames/${CERTAME_ID}`;
const URL_DOWNLOAD = 'https://arquivos.unifesspa.edu.br/acervo/medicina-2027/autodeclaracao.docx';

function exigencia(rotulo: string, modelo: unknown) {
  return {
    rotulo,
    aplicabilidade: 'GERAL',
    obrigatorio: true,
    formatos: { qualquer: false, lista: ['PDF'] },
    modelo,
  };
}

describe('CertameDocumentosComponent', () => {
  let fixture: ComponentFixture<CertameDocumentosComponent>;
  let controller: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CertameDocumentosComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CertameDocumentosComponent);
    fixture.componentRef.setInput('certameId', CERTAME_ID);
    fixture.componentRef.setInput('certameNome', 'Medicina 2027');
    controller = TestBed.inject(HttpTestingController);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  /** Leva a mudança dos sinais até o `httpResource` e de volta ao DOM. */
  async function propagar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  }

  async function abrir(): Promise<void> {
    host.querySelector<HTMLButtonElement>('button')?.click();
    await propagar();
  }

  /** Uma página de certames não lê o edital de cada um sem que alguém peça. */
  it('só lê o certame publicado quando o painel abre', async () => {
    await propagar();
    controller.expectNone(ROTA_CERTAME);

    await abrir();

    controller.expectOne(ROTA_CERTAME).flush({ documentosExigidos: [] });
  });

  /**
   * O link é navegação simples ao acervo público — `<a href>` com o `urlDownload`, sem `fetch` —,
   * e só aparece na exigência que oferece modelo.
   */
  it('oferece o download do modelo pelo link público da exigência', async () => {
    await abrir();
    controller.expectOne(ROTA_CERTAME).flush({
      documentosExigidos: [
        exigencia('Autodeclaração étnico-racial', {
          nomeArquivo: 'autodeclaracao.docx',
          formato: 'DOCX',
          hashSha256: 'ab'.repeat(32),
          urlDownload: URL_DOWNLOAD,
        }),
        exigencia('Documento de identidade', null),
      ],
    });
    await propagar();

    const links = [...host.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(URL_DOWNLOAD);
    expect(links[0].textContent?.replace(/\s+/g, ' ')).toContain('Baixar o modelo (DOCX)');
    expect(links[0].textContent).toContain('Autodeclaração étnico-racial');
  });
});
