import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { PUBLICACOES_BASE_PATH, type TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoRegistroDoAto,
  StatusProcesso,
  type AtoDoProcessoDto,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PublicacoesDoProcessoPage } from './publicacoes-do-processo.page';
import { PublicarDocumentoComponent } from './publicar-documento.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_ATOS = `${ROTA_PROCESSO}/atos`;
const ROTA_TIPOS = `${BASE}/api/publicacoes/tipos-ato`;

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

const TIPOS = [
  tipo('EDITAL_ABERTURA', { congelaConfiguracao: true, publicavelComoAvulso: false }),
  tipo('AVISO'),
  tipo('ERRATA', { exigeAtoCorrigido: true }),
];

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
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: PROCESSO_ID })) },
        },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function abrir(status: string, atos: readonly AtoDoProcessoDto[]): Promise<void> {
    fixture = TestBed.createComponent(PublicacoesDoProcessoPage);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    controller
      .expectOne(ROTA_PROCESSO)
      .flush({ id: PROCESSO_ID, nome: 'Medicina 2027', status } as ProcessoSeletivoDto);
    controller.expectOne(ROTA_ATOS).flush(atos);
    controller.expectOne((r) => r.url === ROTA_TIPOS).flush(TIPOS);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const linhas = (): HTMLTableRowElement[] => Array.from(host.querySelectorAll('tbody tr'));
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
    await fixture.whenStable();
    fixture.detectChanges();

    expect(linhas()).toHaveLength(2);
    expect(linhas()[0].textContent).toContain('Comunicado');
    expect(linhas()[0].textContent).toContain('Em processamento');
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
