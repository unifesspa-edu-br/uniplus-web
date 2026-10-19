import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoRegistroDoAto,
  type AtoDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PublicarDocumentoComponent, type ModoDaPublicacao } from './publicar-documento.component';
import type { EnviosDeArquivos } from './envios-de-arquivos';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_ATOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/atos`;
const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-a-publicar`;
const DOCUMENTO_PRINCIPAL = '01960000-0000-7000-0000-0000000005d1';
const DOCUMENTO_ANEXO = '01960000-0000-7000-0000-0000000005d2';
const ATO_AVISO = '01960000-0000-7000-0000-0000000005e1';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function tipo(codigo: string, sobrescritas: Partial<TipoAtoPublicadoDto> = {}): TipoAtoPublicadoDto {
  return {
    id: `id-${codigo}`,
    codigo,
    nome: codigo === 'ERRATA' ? 'Errata' : 'Aviso',
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
    ...sobrescritas,
  };
}

const AVISO = tipo('AVISO');
const ERRATA = tipo('ERRATA', { exigeAtoCorrigido: true });

const aviso: AtoDoProcessoDto = {
  id: ATO_AVISO,
  tipoCodigo: 'AVISO',
  tipoNome: 'Aviso',
  numero: '01/2026',
  dataDoAto: '2026-10-10',
  publicadoEm: '2026-10-10T12:00:00Z',
  assinante: 'Pró-reitoria de Ensino',
  situacao: SituacaoDoRegistroDoAto.registrado,
  registradoEm: '2026-10-10T12:01:00Z',
  pendenciaAcimaDoLimiar: false,
  atoCorrigidoId: null,
  motivoDaCorrecao: null,
  produtoDoEditalId: null,
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

function arquivo(nome: string): File {
  return new File([new Uint8Array(2048).fill(37)], nome);
}

/** Cede o event loop para a cadeia de `await` do componente avançar até a próxima requisição. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: { status, statusText: title, headers: { 'Content-Type': 'application/problem+json' } },
  };
}

describe('PublicarDocumentoComponent', () => {
  let fixture: ComponentFixture<PublicarDocumentoComponent>;
  let componente: PublicarDocumentoComponent;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let publicados: number;

  beforeEach(() => {
    publicados = 0;
    TestBed.configureTestingModule({
      imports: [PublicarDocumentoComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function abrir(modo: ModoDaPublicacao): Promise<void> {
    fixture = TestBed.createComponent(PublicarDocumentoComponent);
    componente = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    componente.publicado.subscribe(() => (publicados += 1));
    fixture.componentRef.setInput('processoId', PROCESSO_ID);
    fixture.componentRef.setInput('modo', modo);
    fixture.componentRef.setInput('tipos', [AVISO, ERRATA]);
    fixture.componentRef.setInput('atosCorrigiveis', [aviso]);
    fixture.componentRef.setInput('aberto', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Envia um arquivo até o selo e devolve quando a lista o tem como confirmado. */
  async function enviar(
    lista: EnviosDeArquivos,
    nome: string,
    documentoId: string,
    tipoDeMidia: string,
  ): Promise<void> {
    lista.escolher([arquivo(nome)]);
    await tick();
    const url = `http://localhost:9000/uniplus-selecao/atos/${documentoId}?X-Amz-Signature=a`;
    const inicio = controller.expectOne(ROTA_DOCUMENTOS);
    expect(inicio.request.body).toEqual({
      finalidade: 'documentoDeAto',
      nomeArquivo: nome,
      tipoDeMidia,
    });
    inicio.flush(
      {
        documentoAPublicarId: documentoId,
        urlUpload: url,
        contentTypeExigido: tipoDeMidia,
        expiraEm: new Date(Date.now() + 900_000).toISOString(),
      },
      { status: 201, statusText: 'Created' },
    );
    await tick();
    controller.expectOne(url).flush(null);
    await tick();
    controller.expectOne(`${ROTA_DOCUMENTOS}/${documentoId}/confirmacao`).flush({ id: documentoId });
    await tick();
  }

  function preencher(valores: {
    tipoAtoCodigo?: string;
    numero?: string;
    assinante?: string;
    atoCorrigidoId?: string;
    motivoDaCorrecao?: string;
  }): void {
    componente['form'].patchValue(valores);
    fixture.detectChanges();
  }

  function clicar(seletor: string): void {
    (host.querySelector(seletor) as HTMLElement).click();
    fixture.detectChanges();
  }

  const textoDoResumo = (): string => (host.querySelector('.pub__resumo')?.textContent ?? '').trim();

  describe('documento avulso', () => {
    beforeEach(async () => {
      await abrir({ tipo: 'avulso' });
    });

    it('liga a mensagem de erro de cada campo ao campo, para o leitor de tela', () => {
      preencher({ tipoAtoCodigo: 'ERRATA' });
      componente['form'].markAllAsTouched();
      componente['form'].controls.numero.setErrors({ servidor: { mensagem: 'Número inválido.' } });
      fixture.detectChanges();

      for (const campo of ['pub-numero', 'pub-corrigido', 'pub-assinante', 'pub-motivo']) {
        const controle = host.querySelector(`#${campo}`) as HTMLElement;
        const erro = host.querySelector(`#${campo}-erro`);
        expect(erro, campo).not.toBeNull();
        expect(controle.getAttribute('aria-describedby') ?? '', campo).toContain(`${campo}-erro`);
      }
    });

    it('pede o ato corrigido só quando o tipo escolhido corrige outro', () => {
      preencher({ tipoAtoCodigo: 'AVISO' });
      expect(host.querySelector('#pub-corrigido')).toBeNull();

      preencher({ tipoAtoCodigo: 'ERRATA' });
      expect(host.querySelector('#pub-corrigido')).not.toBeNull();
      expect(host.querySelector('#pub-motivo')).not.toBeNull();
    });

    it('avisa que a publicação é irreversível e só envia depois da confirmação', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino', numero: '02/2026' });
      await enviar(componente['principal'], 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      await enviar(componente['anexos'], 'planilha.docx', DOCUMENTO_ANEXO, DOCX);

      clicar('button[type="submit"]');

      controller.expectNone(ROTA_ATOS);
      expect(componente['confirmando']()).toBe(true);
      expect(host.querySelector('.uni-dialog__body')?.textContent).toContain('não pode ser desfeita');

      clicar('[data-testid="confirm-dialog-confirm"]');
      const requisicao = controller.expectOne(ROTA_ATOS);
      expect(requisicao.request.body).toMatchObject({
        tipoAtoCodigo: 'AVISO',
        numero: '02/2026',
        assinante: 'Pró-reitoria de Ensino',
        documentoPrincipalId: DOCUMENTO_PRINCIPAL,
        anexos: [{ documentoId: DOCUMENTO_ANEXO, nome: 'planilha' }],
      });
      expect(requisicao.request.body).not.toHaveProperty('atoCorrigidoId');
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();

      expect(publicados).toBe(1);
      expect(componente.aberto()).toBe(false);
    });

    it('não envia sem o documento principal, diz o que falta e leva o foco ao aviso', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });

      clicar('button[type="submit"]');
      await tick();
      fixture.detectChanges();

      expect(componente['confirmando']()).toBe(false);
      expect(textoDoResumo()).toContain('Envie o documento principal');
      expect(document.activeElement).toBe(host.querySelector('.pub__resumo'));
    });

    it('tira o aviso da tela quando a pessoa resolve o que faltava', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      clicar('button[type="submit"]');
      expect(textoDoResumo()).toContain('Envie o documento principal');

      await enviar(componente['principal'], 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      fixture.detectChanges();

      expect(host.querySelector('.pub__resumo')).toBeNull();
    });

    it('não leva o ato corrigido escolhido antes de trocar para um tipo que não corrige', async () => {
      preencher({
        tipoAtoCodigo: 'ERRATA',
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a data.',
      });
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      await enviar(componente['principal'], 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const requisicao = controller.expectOne(ROTA_ATOS);
      expect(requisicao.request.body).not.toHaveProperty('atoCorrigidoId');
      expect(requisicao.request.body).not.toHaveProperty('motivoDaCorrecao');
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });

    it('envia o ato corrigido e o motivo quando o tipo é errata', async () => {
      preencher({
        tipoAtoCodigo: 'ERRATA',
        assinante: 'Pró-reitoria de Ensino',
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a data de abertura.',
      });
      await enviar(componente['principal'], 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const requisicao = controller.expectOne(ROTA_ATOS);
      expect(requisicao.request.body).toMatchObject({
        tipoAtoCodigo: 'ERRATA',
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a data de abertura.',
      });
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });

    it('mostra a recusa do servidor sem perder o que foi preenchido nem os arquivos enviados', async () => {
      preencher({
        tipoAtoCodigo: 'ERRATA',
        assinante: 'Pró-reitoria de Ensino',
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a data de abertura.',
      });
      await enviar(componente['principal'], 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const requisicao = controller.expectOne(ROTA_ATOS);
      const recusa = problema(
        422,
        'uniplus.selecao.ato_do_processo.ato_corrigido_ja_corrigido',
        'O ato corrigido já foi corrigido; a cadeia de correção é linear',
      );
      requisicao.flush(recusa.body, recusa.opts);
      await tick();
      fixture.detectChanges();

      expect(textoDoResumo()).toContain('O ato corrigido já foi corrigido');
      expect(componente.aberto()).toBe(true);
      expect(publicados).toBe(0);
      expect(componente['form'].getRawValue()).toMatchObject({
        tipoAtoCodigo: 'ERRATA',
        assinante: 'Pró-reitoria de Ensino',
        motivoDaCorrecao: 'Corrige a data de abertura.',
      });
      expect(componente['principal'].confirmados()).toHaveLength(1);
      expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    });

    it('marca o campo que o servidor recusou com a mensagem dele', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      await enviar(componente['principal'], 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const requisicao = controller.expectOne(ROTA_ATOS);
      requisicao.flush(
        {
          type: 'about:blank',
          title: 'Dados inválidos',
          status: 422,
          code: 'uniplus.validation.failed',
          traceId: 'trace-1',
          errors: [{ field: 'Assinante', code: 'maxlength', message: 'Assinante deve ter no máximo 200 caracteres.' }],
        },
        { status: 422, statusText: 'Unprocessable', headers: { 'Content-Type': 'application/problem+json' } },
      );
      await tick();
      fixture.detectChanges();

      expect(host.querySelector('#pub-assinante')?.closest('.field')?.textContent).toContain(
        'Assinante deve ter no máximo 200 caracteres.',
      );
    });

    it('repete o mesmo pedido sob a mesma chave quando a resposta se perde', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      await enviar(componente['principal'], 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const primeira = controller.expectOne(ROTA_ATOS);
      const chave = primeira.request.headers.get('Idempotency-Key');
      expect(chave).not.toBeNull();
      primeira.error(new ProgressEvent('error'));
      await tick();
      fixture.detectChanges();
      expect(textoDoResumo()).toContain('Não foi possível saber se o documento foi publicado');

      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');
      const segunda = controller.expectOne(ROTA_ATOS);

      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });
  });

  describe('correção de um ato', () => {
    beforeEach(async () => {
      await abrir({ tipo: 'correcao', ato: aviso });
    });

    it('fixa o ato corrigido e oferece todos os tipos de documento avulso, não só a errata', () => {
      expect(host.querySelector('#pub-corrigido')).toBeNull();
      expect(host.textContent).toContain('Aviso nº 01/2026');
      expect(Array.from(host.querySelectorAll('#pub-tipo option')).map((o) => o.textContent?.trim())).toEqual([
        'Selecione o tipo',
        'Aviso',
        'Errata',
      ]);
    });

    it('corrige o ato com um aviso, que não exige ato corrigido', async () => {
      preencher({
        tipoAtoCodigo: 'AVISO',
        assinante: 'Pró-reitoria de Ensino',
        motivoDaCorrecao: 'Corrige a data.',
      });
      await enviar(componente['principal'], 'aviso2.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const requisicao = controller.expectOne(ROTA_ATOS);
      expect(requisicao.request.body).toMatchObject({
        tipoAtoCodigo: 'AVISO',
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a data.',
      });
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });

    it('exige o motivo da correção', async () => {
      preencher({ tipoAtoCodigo: 'ERRATA', assinante: 'Pró-reitoria de Ensino' });
      await enviar(componente['principal'], 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

      clicar('button[type="submit"]');

      expect(componente['confirmando']()).toBe(false);
      expect(host.querySelector('#pub-motivo')?.closest('.field')?.textContent).toContain(
        'Campo obrigatório.',
      );
    });

    it('envia o ato clicado como o corrigido', async () => {
      preencher({ tipoAtoCodigo: 'ERRATA', assinante: 'Pró-reitoria de Ensino', motivoDaCorrecao: 'Corrige a data.' });
      await enviar(componente['principal'], 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

      clicar('button[type="submit"]');
      clicar('[data-testid="confirm-dialog-confirm"]');

      const requisicao = controller.expectOne(ROTA_ATOS);
      expect(requisicao.request.body).toMatchObject({
        tipoAtoCodigo: 'ERRATA',
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a data.',
      });
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });
  });
});
