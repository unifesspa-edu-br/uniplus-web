import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoProdutoPrevisto,
  SituacaoDoRegistroDoAto,
  type AtoDoProcessoDto,
  type ProdutoPrevistoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ModoDaPublicacao } from './modo-da-publicacao';
import { PublicarDocumentoComponent } from './publicar-documento.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_ATOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/atos`;
const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-a-publicar`;
const DOCUMENTO_PRINCIPAL = '01960000-0000-7000-0000-0000000005d1';
const DOCUMENTO_ANEXO = '01960000-0000-7000-0000-0000000005d2';
const ATO_AVISO = '01960000-0000-7000-0000-0000000005e1';
const PRODUTO_ID = '01960000-0000-7000-0000-0000000005f1';
const ROTA_PRODUTO = `${ROTA_ATOS.replace('/atos', '')}/produtos-previstos/${PRODUTO_ID}/publicacoes`;
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

function item(sobrescritas: Partial<ProdutoPrevistoDto> = {}): ProdutoPrevistoDto {
  return {
    id: PRODUTO_ID,
    tipoCodigo: 'RESULTADO_HOMOLOGACAO',
    tipoNome: 'Resultado da homologação',
    papel: 'PRELIMINAR',
    situacao: SituacaoDoProdutoPrevisto.aberto,
    ato: null,
    correcoes: [],
    podePublicar: true,
    impedimento: null,
    ...sobrescritas,
  };
}

const POLITICA = { campos: ['Número de inscrição'], justificativa: null };

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
    host = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.publicado.subscribe(() => (publicados += 1));
    fixture.componentRef.setInput('processoId', PROCESSO_ID);
    fixture.componentRef.setInput('modo', modo);
    fixture.componentRef.setInput('tipos', [AVISO, ERRATA]);
    fixture.componentRef.setInput('atosCorrigiveis', [aviso]);
    fixture.componentRef.setInput('aberto', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const PRINCIPAL = '#pub-principal';
  const ANEXOS = '#pub-anexos';

  /** Escolhe o arquivo pelo campo, como a pessoa, e leva o envio até o selo do servidor. */
  async function enviar(
    campo: string,
    nome: string,
    documentoId: string,
    tipoDeMidia: string,
  ): Promise<void> {
    const entrada = host.querySelector<HTMLInputElement>(`input[type="file"]${campo}`);
    if (entrada === null) throw new Error(`campo de arquivo ${campo} ausente`);
    Object.defineProperty(entrada, 'files', { value: [arquivo(nome)], configurable: true });
    entrada.dispatchEvent(new Event('change'));
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
    fixture.detectChanges();
  }

  const CAMPOS = {
    tipoAtoCodigo: '#pub-tipo',
    numero: '#pub-numero',
    assinante: '#pub-assinante',
    atoCorrigidoId: '#pub-corrigido',
    motivoDaCorrecao: '#pub-motivo',
  } as const;

  /** Preenche pelos campos da tela, na ordem dada: o ato corrigido só aparece depois do tipo. */
  function preencher(valores: Partial<Record<keyof typeof CAMPOS, string>>): void {
    for (const [campo, valor] of Object.entries(valores)) {
      const controle = host.querySelector<HTMLInputElement | HTMLSelectElement>(
        CAMPOS[campo as keyof typeof CAMPOS],
      );
      if (controle === null) throw new Error(`campo ${campo} ausente`);
      controle.value = valor;
      controle.dispatchEvent(new Event(controle instanceof HTMLSelectElement ? 'change' : 'input'));
      fixture.detectChanges();
    }
  }

  const valorDe = (seletor: string): string =>
    (host.querySelector(seletor) as HTMLInputElement | HTMLSelectElement).value;
  const confirmando = (): boolean =>
    (host.querySelector('dialog.uni-dialog') as HTMLDialogElement).hasAttribute('open');
  const aberto = (): boolean => fixture.componentInstance.aberto();
  const confirmadosNo = (titulo: string): number =>
    host.querySelectorAll(`[aria-labelledby="${titulo}"] .uni-uploader__item.is-success`).length;

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
      preencher({ tipoAtoCodigo: 'ERRATA', numero: 'N'.repeat(61) });
      clicar('button[type="submit"]');

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
      await enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      await enviar(ANEXOS, 'planilha.docx', DOCUMENTO_ANEXO, DOCX);

      clicar('button[type="submit"]');

      controller.expectNone(ROTA_ATOS);
      expect(confirmando()).toBe(true);
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
      expect(aberto()).toBe(false);
    });

    it('não envia sem o documento principal, diz o que falta e leva o foco ao aviso', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });

      clicar('button[type="submit"]');
      await tick();
      fixture.detectChanges();

      expect(confirmando()).toBe(false);
      expect(textoDoResumo()).toContain('Envie o documento principal');
      expect(document.activeElement).toBe(host.querySelector('.pub__resumo'));
    });

    it('não envia com o nome de anexo que o servidor recusaria e diz de qual anexo é', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      await enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
      await enviar(ANEXOS, 'planilha.docx', DOCUMENTO_ANEXO, DOCX);
      const nome = host.querySelector<HTMLInputElement>('input[id^="pub-anexo-nome-"]') as HTMLInputElement;
      nome.value = 'pasta/planilha';
      nome.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      clicar('button[type="submit"]');

      expect(confirmando()).toBe(false);
      expect(textoDoResumo()).toContain('Anexo planilha.docx: O nome do anexo não pode ter');
    });

    it('tira o aviso da tela quando a pessoa resolve o que faltava', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      clicar('button[type="submit"]');
      expect(textoDoResumo()).toContain('Envie o documento principal');

      await enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
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
      await enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

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
      await enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

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
      await enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
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
      expect(aberto()).toBe(true);
      expect(publicados).toBe(0);
      expect(valorDe('#pub-tipo')).toBe('ERRATA');
      expect(valorDe('#pub-assinante')).toBe('Pró-reitoria de Ensino');
      expect(valorDe('#pub-motivo')).toBe('Corrige a data de abertura.');
      expect(confirmadosNo('pub-principal-titulo')).toBe(1);
      expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
    });

    it('marca o campo que o servidor recusou com a mensagem dele', async () => {
      preencher({ tipoAtoCodigo: 'AVISO', assinante: 'Pró-reitoria de Ensino' });
      await enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
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
      await enviar(PRINCIPAL, 'aviso.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
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
      await enviar(PRINCIPAL, 'aviso2.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

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
      await enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

      clicar('button[type="submit"]');

      expect(confirmando()).toBe(false);
      expect(host.querySelector('#pub-motivo')?.closest('.field')?.textContent).toContain(
        'Campo obrigatório.',
      );
    });

    it('envia o ato clicado como o corrigido', async () => {
      preencher({ tipoAtoCodigo: 'ERRATA', assinante: 'Pró-reitoria de Ensino', motivoDaCorrecao: 'Corrige a data.' });
      await enviar(PRINCIPAL, 'errata.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');

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

  describe('item do edital', () => {
    const confirmar = (): void => {
      clicar('button[type="submit"]');
      if (confirmando()) clicar('[data-testid="confirm-dialog-confirm"]');
    };

    async function preparar(modo: ModoDaPublicacao): Promise<void> {
      await abrir(modo);
      preencher({ assinante: 'Pró-reitoria de Ensino', numero: '01/2026' });
      await enviar(PRINCIPAL, 'lista.pdf', DOCUMENTO_PRINCIPAL, 'application/pdf');
    }

    const publicarResultado: ModoDaPublicacao = {
      tipo: 'previsto',
      item: item(),
      politica: POLITICA,
      corrigido: null,
    };

    it('não pede o tipo, que vem do item, e mostra a política do certame com os campos pelo nome', async () => {
      await abrir({ ...publicarResultado, politica: { campos: ['Número de inscrição', 'Nome'], justificativa: 'Lista nominal prevista no edital.' } });

      expect(host.querySelector('#pub-tipo')).toBeNull();
      expect(host.textContent).toContain('Resultado da homologação');
      const politica = host.querySelector('[aria-labelledby="pub-politica-titulo"]')?.textContent ?? '';
      expect(politica).toContain('Número de inscrição');
      expect(politica).toContain('Nome');
      expect(politica).toContain('Lista nominal prevista no edital.');
    });

    it('não publica o resultado sem a confirmação da política, e leva o foco à confirmação', async () => {
      await preparar(publicarResultado);

      confirmar();
      await tick();
      fixture.detectChanges();

      controller.expectNone(ROTA_PRODUTO);
      expect(confirmando()).toBe(false);
      const caixa = host.querySelector('#pub-politica') as HTMLInputElement;
      expect(caixa.getAttribute('aria-invalid')).toBe('true');
      expect(caixa.getAttribute('aria-describedby')).toContain('pub-politica-erro');
      expect(host.querySelector('#pub-politica-erro')?.textContent).toContain(
        'Confirme que o documento segue a política de divulgação do certame.',
      );
      expect(document.activeElement).toBe(caixa);
    });

    it('publica o resultado no item, sem o tipo, com a confirmação da política', async () => {
      await preparar(publicarResultado);
      (host.querySelector('#pub-politica') as HTMLInputElement).click();
      fixture.detectChanges();

      confirmar();

      const requisicao = controller.expectOne(ROTA_PRODUTO);
      expect(requisicao.request.body).toMatchObject({
        numero: '01/2026',
        assinante: 'Pró-reitoria de Ensino',
        documentoPrincipalId: DOCUMENTO_PRINCIPAL,
        politicaDeDivulgacaoConfirmada: true,
      });
      expect(requisicao.request.body).not.toHaveProperty('tipoAtoCodigo');
      expect(requisicao.request.body).not.toHaveProperty('atoCorrigidoId');
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();

      expect(publicados).toBe(1);
      expect(aberto()).toBe(false);
    });

    it('não mostra a política nem a pede quando o item não é resultado', async () => {
      await preparar({ tipo: 'previsto', item: item({ papel: null }), politica: null, corrigido: null });
      expect(host.querySelector('#pub-politica')).toBeNull();

      confirmar();

      const requisicao = controller.expectOne(ROTA_PRODUTO);
      expect(requisicao.request.body).toMatchObject({ politicaDeDivulgacaoConfirmada: false });
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });

    it('corrige a publicação mais recente: leva o ato corrigido, exige o motivo e a política', async () => {
      await preparar({ ...publicarResultado, corrigido: aviso });
      expect(host.textContent).toContain('Corrigir Aviso nº 01/2026');

      confirmar();
      expect(confirmando()).toBe(false);
      expect(host.querySelector('#pub-motivo')?.closest('.field')?.textContent).toContain('Campo obrigatório.');
      expect(host.querySelector('#pub-politica')?.getAttribute('aria-invalid')).toBe('true');

      preencher({ motivoDaCorrecao: 'Corrige a classificação.' });
      (host.querySelector('#pub-politica') as HTMLInputElement).click();
      fixture.detectChanges();
      confirmar();

      const requisicao = controller.expectOne(ROTA_PRODUTO);
      expect(requisicao.request.body).toMatchObject({
        atoCorrigidoId: ATO_AVISO,
        motivoDaCorrecao: 'Corrige a classificação.',
        politicaDeDivulgacaoConfirmada: true,
      });
      requisicao.flush({ atoId: ATO_AVISO }, { status: 202, statusText: 'Accepted' });
      await tick();
    });

    it('mostra a recusa do servidor com a mensagem do catálogo e mantém o formulário preenchido', async () => {
      await preparar({ ...publicarResultado, item: item({ papel: 'DEFINITIVO' }) });
      (host.querySelector('#pub-politica') as HTMLInputElement).click();
      fixture.detectChanges();
      confirmar();

      const recusa = problema(
        422,
        'uniplus.selecao.ato_do_processo.preliminar_nao_publicado',
        'O resultado definitivo só pode ser publicado depois do preliminar da mesma matéria.',
      );
      controller.expectOne(ROTA_PRODUTO).flush(recusa.body, recusa.opts);
      await tick();
      fixture.detectChanges();

      expect(textoDoResumo()).toContain('só pode ser publicado depois do preliminar');
      expect(aberto()).toBe(true);
      expect((host.querySelector('#pub-politica') as HTMLInputElement).checked).toBe(true);
      expect(confirmadosNo('pub-principal-titulo')).toBe(1);
    });
  });
});
