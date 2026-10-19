import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH, type TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoProdutoPrevisto,
  SituacaoDoRegistroDoAto,
  StatusProcesso,
  type AtoDoProcessoDto,
  type ProcessoSeletivoDto,
  type ProdutoPrevistoDto,
  type ProdutosPrevistosDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PublicacoesDoProcessoPage } from './publicacoes-do-processo.page';
import { PublicarDocumentoComponent } from './publicar-documento.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_ATOS = `${ROTA_PROCESSO}/atos`;
const ROTA_TIPOS = `${BASE}/api/publicacoes/tipos-ato`;
const ROTA_PREVISTOS = `${ROTA_PROCESSO}/produtos-previstos`;
const ROTA_CAMPOS = `${BASE}/api/selecao/campos-divulgacao`;
const ROTA_FASES = `${BASE}/api/configuracao/fases-canonicas`;

function tipo(codigo: string, sobrescritas: Partial<TipoAtoPublicadoDto> = {}): TipoAtoPublicadoDto {
  return {
    id: `id-${codigo}`,
    codigo,
    nome: codigo,
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

function ato(id: string, sobrescritas: Partial<AtoDoProcessoDto> = {}): AtoDoProcessoDto {
  return {
    id,
    tipoCodigo: 'AVISO',
    tipoNome: 'Aviso',
    numero: null,
    dataDoAto: '2026-10-10',
    publicadoEm: '2026-10-10T15:00:00Z',
    assinante: 'Pró-reitoria de Ensino',
    situacao: SituacaoDoRegistroDoAto.registrado,
    registradoEm: '2026-10-10T15:01:00Z',
    pendenciaAcimaDoLimiar: false,
    atoCorrigidoId: null,
    motivoDaCorrecao: null,
    produtoDoEditalId: null,
    politicaDeDivulgacaoConfirmada: false,
    documentoPrincipal: {
      documentoAPublicarId: `doc-${id}`,
      nomeArquivo: `${id}.pdf`,
      nomeDeExibicao: null,
      tipoDeMidia: 'application/pdf',
      hashSha256: 'a'.repeat(64),
    },
    anexos: [],
    ...sobrescritas,
  };
}

function item(id: string, sobrescritas: Partial<ProdutoPrevistoDto> = {}): ProdutoPrevistoDto {
  return {
    id,
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

function previstos(...itens: readonly ProdutoPrevistoDto[]): ProdutosPrevistosDoProcessoDto {
  return {
    numeroDaVersao: 1,
    politicaDeDivulgacao: { camposPublicos: ['numero_inscricao'], justificativa: null },
    fases: [{ id: 'f1', codigo: 'INSCRICAO', ordem: 1, produtos: itens, etapas: [] }],
    etapasSemFase: [],
  };
}

const CAMPOS = [
  { codigo: 'numero_inscricao', nome: 'Número de inscrição', obrigatorio: true, exigeJustificativa: false },
];
const FASES = [{ id: 'fase-1', codigo: 'INSCRICAO', nome: 'Inscrição' }];

const TIPOS = [
  tipo('EDITAL_ABERTURA', { congelaConfiguracao: true, publicavelComoAvulso: false }),
  tipo('AVISO'),
  tipo('ERRATA', { exigeAtoCorrigido: true }),
];

/** Cede o event loop para a cadeia de `await` da página avançar até a próxima requisição. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('PublicacoesDoProcessoPage', () => {
  let fixture: ComponentFixture<PublicacoesDoProcessoPage>;
  let controller: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PublicacoesDoProcessoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: PROCESSO_ID })) },
        },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function responderPrevistos(itens: ProdutosPrevistosDoProcessoDto, camposFalham = false): void {
    controller.expectOne(ROTA_PREVISTOS).flush(itens);
    if (camposFalham) {
      controller.expectOne(ROTA_CAMPOS).flush(null, { status: 503, statusText: 'Service Unavailable' });
    } else {
      controller.expectOne(ROTA_CAMPOS).flush(CAMPOS);
    }
    controller.expectOne((r) => r.url === ROTA_FASES).flush(FASES);
  }

  async function abrir(
    status: string,
    atos: readonly AtoDoProcessoDto[],
    itensPrevistos: ProdutosPrevistosDoProcessoDto = previstos(),
    camposFalham = false,
  ): Promise<void> {
    fixture = TestBed.createComponent(PublicacoesDoProcessoPage);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    controller
      .expectOne(ROTA_PROCESSO)
      .flush({ id: PROCESSO_ID, nome: 'Medicina 2027', status } as ProcessoSeletivoDto);
    controller.expectOne(ROTA_ATOS).flush(atos);
    controller.expectOne((r) => r.url === ROTA_TIPOS).flush(TIPOS);
    if (status !== StatusProcesso.rascunho) {
      // Os itens do edital só são pedidos depois de o processo dizer que já não é rascunho.
      await tick();
      responderPrevistos(itensPrevistos, camposFalham);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const linhas = (): HTMLTableRowElement[] =>
    Array.from(host.querySelectorAll('sel-atos-do-processo tbody tr'));
  const linhasDosPrevistos = (): HTMLTableRowElement[] =>
    Array.from(host.querySelectorAll('sel-previstos-no-edital tbody tr'));
  const botao = (linha: HTMLTableRowElement, texto: string): HTMLButtonElement | undefined =>
    Array.from(linha.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
  const temCorrigir = (linha: HTMLTableRowElement): boolean =>
    Array.from(linha.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Corrigir');

  it('liga a errata ao aviso e deixa de oferecer "Corrigir" no aviso original', async () => {
    const aviso = ato('aviso', { numero: '01/2026' });
    const errata = ato('errata', {
      tipoCodigo: 'ERRATA',
      tipoNome: 'Errata',
      atoCorrigidoId: 'aviso',
      motivoDaCorrecao: 'Corrige a data.',
    });

    await abrir(StatusProcesso.publicado, [errata, aviso]);

    const [linhaDaErrata, linhaDoAviso] = linhas();
    expect(linhaDaErrata.textContent).toContain('Corrige: Aviso nº 01/2026');
    expect(linhaDaErrata.textContent).toContain('Motivo: Corrige a data.');
    expect(temCorrigir(linhaDaErrata)).toBe(true);
    expect(linhaDoAviso.textContent).toContain('Corrigido por: Errata');
    expect(temCorrigir(linhaDoAviso)).toBe(false);
  });

  it('não oferece "Corrigir" no edital, que só se corrige por retificação', async () => {
    const edital = ato('edital', { tipoCodigo: 'EDITAL_ABERTURA', tipoNome: 'Edital de abertura' });

    await abrir(StatusProcesso.publicado, [edital]);

    expect(temCorrigir(linhas()[0])).toBe(false);
  });

  it('destaca o documento em processamento há mais tempo que o esperado', async () => {
    const pendente = ato('aviso', {
      situacao: SituacaoDoRegistroDoAto.pendente,
      registradoEm: null,
      pendenciaAcimaDoLimiar: true,
    });

    await abrir(StatusProcesso.publicado, [pendente]);

    expect(host.textContent).toContain('Há documento em processamento há mais tempo que o normal');
    expect(linhas()[0].textContent).toContain('Em processamento há muito tempo');
    expect(temCorrigir(linhas()[0])).toBe(false);
  });

  it('abre o formulário de correção com o ato clicado', async () => {
    await abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);

    const corrigir = Array.from(linhas()[0].querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Corrigir',
    ) as HTMLButtonElement;
    corrigir.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['modo']()).toEqual({
      tipo: 'correcao',
      ato: expect.objectContaining({ id: 'aviso' }),
    });
    expect(fixture.componentInstance['formularioAberto']()).toBe(true);
  });

  it('relê os atos quando o documento é publicado e mostra o novo na lista', async () => {
    await abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);
    expect(linhas()).toHaveLength(1);

    const formulario = fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    (formulario.componentInstance as PublicarDocumentoComponent).publicado.emit();

    const novo = ato('comunicado', {
      tipoCodigo: 'COMUNICADO',
      tipoNome: 'Comunicado',
      situacao: SituacaoDoRegistroDoAto.pendente,
      registradoEm: null,
    });
    controller.expectOne(ROTA_ATOS).flush([novo, ato('aviso', { numero: '01/2026' })]);
    responderPrevistos(previstos());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(linhas()).toHaveLength(2);
    expect(linhas()[0].textContent).toContain('Comunicado');
    expect(linhas()[0].textContent).toContain('Em processamento');
  });

  it('lista os itens do edital por fase e libera "Publicar" só no que o servidor libera', async () => {
    const preliminar = item('preliminar');
    const definitivo = item('definitivo', {
      papel: 'DEFINITIVO',
      podePublicar: false,
      impedimento: {
        motivo: 'preliminarNaoPublicado',
        mensagem: 'O resultado definitivo só pode ser publicado depois do preliminar da mesma matéria.',
      } as ProdutoPrevistoDto['impedimento'],
    });

    await abrir(StatusProcesso.publicado, [], previstos(preliminar, definitivo));

    expect(host.querySelector('sel-previstos-no-edital h3')?.textContent).toContain('Inscrição');
    const [linhaDoPreliminar, linhaDoDefinitivo] = linhasDosPrevistos();
    expect(botao(linhaDoPreliminar, 'Publicar')).toBeDefined();
    expect(botao(linhaDoDefinitivo, 'Publicar')).toBeUndefined();
    expect(linhaDoDefinitivo.textContent).toContain('só pode ser publicado depois do preliminar');
  });

  it('abre o formulário do resultado com a política do certame pelos nomes dos campos', async () => {
    await abrir(StatusProcesso.publicado, [], previstos(item('preliminar')));

    botao(linhasDosPrevistos()[0], 'Publicar')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['modo']()).toMatchObject({
      tipo: 'previsto',
      item: { id: 'preliminar' },
      politica: { campos: ['Número de inscrição'], justificativa: null },
      corrigido: null,
    });
    expect(fixture.componentInstance['formularioAberto']()).toBe(true);
  });

  it('sem o catálogo de campos, publica do mesmo jeito e mostra a política pelo código', async () => {
    await abrir(StatusProcesso.publicado, [], previstos(item('preliminar')), true);

    botao(linhasDosPrevistos()[0], 'Publicar')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['modo']()).toMatchObject({
      tipo: 'previsto',
      politica: { campos: ['numero_inscricao'] },
    });
  });

  it('abre a correção do item apontando a correção mais recente da cadeia', async () => {
    const original = ato('original', { produtoDoEditalId: 'preliminar' });
    const errata = ato('errata', { produtoDoEditalId: 'preliminar', atoCorrigidoId: 'original' });
    const publicado = item('preliminar', {
      situacao: SituacaoDoProdutoPrevisto.publicado,
      ato: original,
      correcoes: [errata],
      podePublicar: false,
    });

    await abrir(StatusProcesso.publicado, [errata, original], previstos(publicado));

    botao(linhasDosPrevistos()[0], 'Corrigir')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['modo']()).toMatchObject({
      tipo: 'previsto',
      corrigido: { id: 'errata' },
    });
  });

  it('não oferece, na lista de documentos, a correção do ato de um item do edital', async () => {
    const doItem = ato('resultado', { produtoDoEditalId: 'preliminar' });

    await abrir(StatusProcesso.publicado, [doItem]);

    expect(temCorrigir(linhas()[0])).toBe(false);
  });

  it('relê os itens quando o documento é publicado e libera o definitivo', async () => {
    const definitivoBloqueado = item('definitivo', {
      papel: 'DEFINITIVO',
      podePublicar: false,
      impedimento: {
        motivo: 'preliminarAguardaConfirmacao',
        mensagem: 'O preliminar aguarda a confirmação do registro.',
      } as ProdutoPrevistoDto['impedimento'],
    });
    await abrir(StatusProcesso.publicado, [], previstos(item('preliminar'), definitivoBloqueado));
    expect(botao(linhasDosPrevistos()[1], 'Publicar')).toBeUndefined();

    const formulario = fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    (formulario.componentInstance as PublicarDocumentoComponent).publicado.emit();

    controller.expectOne(ROTA_ATOS).flush([]);
    responderPrevistos(
      previstos(
        item('preliminar', {
          situacao: SituacaoDoProdutoPrevisto.publicado,
          ato: ato('original', { produtoDoEditalId: 'preliminar' }),
          podePublicar: false,
        }),
        item('definitivo', { papel: 'DEFINITIVO' }),
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const [linhaDoPreliminar, linhaDoDefinitivo] = linhasDosPrevistos();
    expect(linhaDoPreliminar.textContent).toContain('Publicado em');
    expect(botao(linhaDoDefinitivo, 'Publicar')).toBeDefined();
  });

  it('não permite publicar antes de o processo ser publicado', async () => {
    await abrir(StatusProcesso.rascunho, []);

    expect(host.textContent).toContain('O processo ainda não foi publicado');
    expect(host.querySelector('sel-atos-do-processo')).toBeNull();
    const publicar = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Publicar documento',
    ) as HTMLButtonElement;
    expect(publicar.disabled).toBe(true);
  });
});
