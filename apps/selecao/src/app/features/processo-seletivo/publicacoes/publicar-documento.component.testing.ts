import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoProdutoPrevisto,
  type AtoDoProcessoDto,
  type ProdutoPrevistoDto,
} from '@uniplus/shared-data/selecao';
import { expect } from 'vitest';

import type { ModoDaPublicacao } from './modo-da-publicacao';
import { PublicarDocumentoComponent } from './publicar-documento.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_ATOS = `${ROTA_PROCESSO}/atos`;
const ROTA_DOCUMENTOS = `${ROTA_PROCESSO}/documentos-a-publicar`;
export const DOCUMENTO_PRINCIPAL = '01960000-0000-7000-0000-0000000005d1';
export const DOCUMENTO_ANEXO = '01960000-0000-7000-0000-0000000005d2';
export const ATO_AVISO = '01960000-0000-7000-0000-0000000005e1';
const PRODUTO_ID = '01960000-0000-7000-0000-0000000005f1';
export const ROTA_PRODUTO = `${ROTA_PROCESSO}/produtos-previstos/${PRODUTO_ID}/publicacoes`;
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PRINCIPAL = '#pub-principal';
export const ANEXOS = '#pub-anexos';
export const POLITICA = { campos: ['Número de inscrição'], justificativa: null };

const CAMPOS = {
  tipoAtoCodigo: '#pub-tipo',
  numero: '#pub-numero',
  assinante: '#pub-assinante',
  atoCorrigidoId: '#pub-corrigido',
  motivoDaCorrecao: '#pub-motivo',
} as const;

const TIPO_PADRAO: Omit<TipoAtoPublicadoDto, 'id' | 'codigo' | 'nome'> = {
  congelaConfiguracao: false,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: false,
  publicavelComoAvulso: true,
  exigeAtoCorrigido: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-01-01T00:00:00Z',
};

function tipo(
  codigo: string,
  sobrescritas: Partial<TipoAtoPublicadoDto> = {},
): TipoAtoPublicadoDto {
  const nome = codigo === 'ERRATA' ? 'Errata' : 'Aviso';
  return { id: `id-${codigo}`, codigo, nome, ...TIPO_PADRAO, ...sobrescritas };
}

const AVISO = tipo('AVISO');
const ERRATA = tipo('ERRATA', { exigeAtoCorrigido: true });

export const aviso: AtoDoProcessoDto = {
  id: ATO_AVISO,
  tipoCodigo: 'AVISO',
  tipoNome: 'Aviso',
  numero: '01/2026',
  dataDoAto: '2026-10-10',
  publicadoEm: '2026-10-10T12:00:00Z',
  assinante: 'Pró-reitoria de Ensino',
  atoCorrigidoId: null,
  motivoDaCorrecao: null,
  politicaDeDivulgacaoConfirmada: false,
  documentoPrincipal: {
    documentoAPublicarId: DOCUMENTO_PRINCIPAL,
    nomeArquivo: 'aviso.pdf',
    nomeDeExibicao: null,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'a'.repeat(64),
  },
  anexos: [],
};

const ITEM_PADRAO: Omit<ProdutoPrevistoDto, 'id'> = {
  tipoCodigo: 'RESULTADO_HOMOLOGACAO',
  tipoNome: 'Resultado da homologação',
  papel: 'PRELIMINAR',
  situacao: SituacaoDoProdutoPrevisto.aberto,
  ato: null,
  correcoes: [],
  podePublicar: true,
  impedimento: null,
};

export function item(sobrescritas: Partial<ProdutoPrevistoDto> = {}): ProdutoPrevistoDto {
  return { id: PRODUTO_ID, ...ITEM_PADRAO, ...sobrescritas };
}

function arquivo(nome: string): File {
  return new File([new Uint8Array(2048).fill(37)], nome);
}

/** Cede o event loop para a cadeia de `await` do componente avançar até a próxima requisição. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: { status, statusText: title, headers: { 'Content-Type': 'application/problem+json' } },
  };
}

function urlDoUpload(documentoId: string): string {
  return `http://localhost:9000/uniplus-selecao/atos/${documentoId}?X-Amz-Signature=a`;
}

function inicioDoEnvio(documentoId: string, tipoDeMidia: string) {
  return {
    documentoAPublicarId: documentoId,
    urlUpload: urlDoUpload(documentoId),
    contentTypeExigido: tipoDeMidia,
    expiraEm: new Date(Date.now() + 900_000).toISOString(),
  };
}

/** O formulário de publicação aberto contra o servidor simulado, operado pelos campos da tela. */
export class TelaDePublicarDocumento {
  readonly controller: HttpTestingController;
  fixture!: ComponentFixture<PublicarDocumentoComponent>;
  host!: HTMLElement;
  publicados = 0;

  constructor() {
    TestBed.configureTestingModule({
      imports: [PublicarDocumentoComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    this.controller = TestBed.inject(HttpTestingController);
  }

  async abrir(modo: ModoDaPublicacao): Promise<void> {
    this.fixture = TestBed.createComponent(PublicarDocumentoComponent);
    this.host = this.fixture.nativeElement as HTMLElement;
    this.fixture.componentInstance.publicado.subscribe(() => (this.publicados += 1));
    this.fixture.componentRef.setInput('processoId', PROCESSO_ID);
    this.fixture.componentRef.setInput('modo', modo);
    this.fixture.componentRef.setInput('tipos', [AVISO, ERRATA]);
    this.fixture.componentRef.setInput('atosCorrigiveis', [aviso]);
    this.fixture.componentRef.setInput('aberto', true);
    this.fixture.detectChanges();
    await this.fixture.whenStable();
    this.fixture.detectChanges();
  }

  private escolherArquivo(campo: string, nome: string): void {
    const entrada = this.host.querySelector<HTMLInputElement>(`input[type="file"]${campo}`);
    if (entrada === null) throw new Error(`campo de arquivo ${campo} ausente`);
    Object.defineProperty(entrada, 'files', { value: [arquivo(nome)], configurable: true });
    entrada.dispatchEvent(new Event('change'));
  }

  private responderInicioDoEnvio(nome: string, documentoId: string, tipoDeMidia: string): void {
    const inicio = this.controller.expectOne(ROTA_DOCUMENTOS);
    expect(inicio.request.body).toEqual({
      finalidade: 'documentoDeAto',
      nomeArquivo: nome,
      tipoDeMidia,
    });
    inicio.flush(inicioDoEnvio(documentoId, tipoDeMidia), { status: 201, statusText: 'Created' });
  }

  private async selarEnvio(documentoId: string): Promise<void> {
    this.controller.expectOne(urlDoUpload(documentoId)).flush(null);
    await tick();
    this.controller
      .expectOne(`${ROTA_DOCUMENTOS}/${documentoId}/confirmacao`)
      .flush({ id: documentoId });
    await tick();
  }

  /** Escolhe o arquivo pelo campo, como a pessoa, e leva o envio até o selo do servidor. */
  async enviar(
    campo: string,
    nome: string,
    documentoId: string,
    tipoDeMidia: string,
  ): Promise<void> {
    this.escolherArquivo(campo, nome);
    await tick();
    this.responderInicioDoEnvio(nome, documentoId, tipoDeMidia);
    await tick();
    await this.selarEnvio(documentoId);
    this.fixture.detectChanges();
  }

  /** Preenche pelos campos da tela, na ordem dada: o ato corrigido só aparece depois do tipo. */
  preencher(valores: Partial<Record<keyof typeof CAMPOS, string>>): void {
    for (const [campo, valor] of Object.entries(valores)) {
      const controle = this.host.querySelector<HTMLInputElement | HTMLSelectElement>(
        CAMPOS[campo as keyof typeof CAMPOS],
      );
      if (controle === null) throw new Error(`campo ${campo} ausente`);
      controle.value = valor;
      controle.dispatchEvent(new Event(controle instanceof HTMLSelectElement ? 'change' : 'input'));
      this.fixture.detectChanges();
    }
  }

  valorDe(seletor: string): string {
    return (this.host.querySelector(seletor) as HTMLInputElement | HTMLSelectElement).value;
  }

  confirmando(): boolean {
    return (this.host.querySelector('dialog.uni-dialog') as HTMLDialogElement).hasAttribute('open');
  }

  aberto(): boolean {
    return this.fixture.componentInstance.aberto();
  }

  confirmadosNo(titulo: string): number {
    const confirmados = `[aria-labelledby="${titulo}"] .uni-uploader__item.is-success`;
    return this.host.querySelectorAll(confirmados).length;
  }

  clicar(seletor: string): void {
    (this.host.querySelector(seletor) as HTMLElement).click();
    this.fixture.detectChanges();
  }

  textoDoResumo(): string {
    return (this.host.querySelector('.pub__resumo')?.textContent ?? '').trim();
  }

  async publicarERecusar(recusa: ReturnType<typeof problema>): Promise<void> {
    this.clicar('button[type="submit"]');
    this.clicar('[data-testid="confirm-dialog-confirm"]');
    this.controller.expectOne(ROTA_ATOS).flush(recusa.body, recusa.opts);
    await tick();
    this.fixture.detectChanges();
  }
}
