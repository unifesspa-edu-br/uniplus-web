import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, type HttpTestingController } from '@angular/common/http/testing';
import { type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotasDoEnemPage } from './notas-do-enem.page';
import {
  SELECAO_BASE_PATH,
  type LeiauteDoInepDto,
  type ProcessoSeletivoDto,
  type SnapshotVigenteDto,
} from '@uniplus/shared-data/selecao';

/** Apoio dos testes da tela de notas do ENEM: rotas simuladas e respostas no formato da API. */
export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000005bb';
export const ETAPA_ID = '01960000-0000-7000-0000-0000000005cc';
export const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_SNAPSHOT = `${ROTA_PROCESSO}/snapshot-vigente`;
export const ROTA_EDICAO = `${ROTA_PROCESSO}/etapas/${ETAPA_ID}/edicoes-do-enem/2025`;
export const ROTA_LEIAUTES = `${BASE}/api/selecao/leiautes-de-arquivo-do-inep`;

export function providersDaTela(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    {
      provide: ActivatedRoute,
      useValue: { paramMap: of(convertToParamMap({ id: PROCESSO_ID })) },
    },
  ];
}

/** O processo como a configuração administrativa o mostra; etapas e edições vêm da versão publicada. */
export function processo(
  sobrescritas: { status?: string; identificadorLegivel?: string | null } = {},
): ProcessoSeletivoDto {
  const { status = 'publicado', identificadorLegivel = null } = sobrescritas;
  return {
    id: PROCESSO_ID,
    nome: 'Medicina 2027',
    status,
    identificadorLegivel,
  } as unknown as ProcessoSeletivoDto;
}

/** O snapshot vigente: a configuração congelada na publicação, que é a que a API usa. */
export function snapshotVigente(
  sobrescritas: { etapaDoEnem?: boolean; edicoes?: readonly string[] } = {},
): SnapshotVigenteDto {
  const { etapaDoEnem = true, edicoes = ['2024', '2025'] } = sobrescritas;
  return {
    configuracao: {
      etapas: [
        { id: 'outra', nome: 'Prova objetiva', tipoEtapa: { notaDeOrigemNoEnem: false } },
        ...(etapaDoEnem
          ? [{ id: ETAPA_ID, nome: 'Nota do ENEM', tipoEtapa: { notaDeOrigemNoEnem: true } }]
          : []),
      ],
      fatosColetados: [
        {
          fatoCodigo: 'EDICAO_ENEM',
          valoresSelecionaveis: edicoes.map((valorCodigo, indice) => ({
            valorCodigo,
            ordem: indice + 1,
          })),
        },
      ],
    },
  } as unknown as SnapshotVigenteDto;
}

export function leiaute(
  codigo: string,
  tipo: 'envio' | 'retorno',
  sobrescritas: Partial<LeiauteDoInepDto> = {},
): LeiauteDoInepDto {
  return {
    codigo,
    versao: 'v1',
    tipo,
    descricao: `Leiaute ${codigo}`,
    hash: 'h'.repeat(64),
    quantidadeDeCampos: 20,
    ...sobrescritas,
  };
}

export const LEIAUTES_DE_ENVIO = [leiaute('ENVIO_CPF', 'envio')];
export const LEIAUTES_DE_RETORNO = [
  leiaute('RETORNO_20', 'retorno', { descricao: 'Retorno do INEP com 20 campos' }),
  leiaute('RETORNO_21', 'retorno', { descricao: 'Retorno do INEP com 21 campos' }),
];

/** Cede o event loop para a cadeia de `await` da página avançar até a próxima requisição. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Responde a leitura inicial da página: o processo, o snapshot vigente (que só se lê com o processo
 * publicado; `null` é a ausência dele, um 404) e os dois catálogos de leiautes.
 */
export async function responderALeituraInicial(
  controller: HttpTestingController,
  processoLido: ProcessoSeletivoDto,
  leiautes: { envio?: readonly LeiauteDoInepDto[]; retorno?: readonly LeiauteDoInepDto[] } = {},
  publicada: SnapshotVigenteDto | null = snapshotVigente(),
): Promise<void> {
  controller.expectOne(ROTA_PROCESSO).flush(processoLido);
  if (processoLido.status !== 'rascunho') {
    await tick();
    const requisicao = controller.expectOne(ROTA_SNAPSHOT);
    if (publicada === null) {
      requisicao.flush({ title: 'Sem versão publicada' }, { status: 404, statusText: 'Not Found' });
    } else {
      requisicao.flush(publicada);
    }
  }
  controller
    .expectOne((r) => r.url === ROTA_LEIAUTES && r.params.get('tipo') === 'envio')
    .flush(leiautes.envio ?? LEIAUTES_DE_ENVIO);
  controller
    .expectOne((r) => r.url === ROTA_LEIAUTES && r.params.get('tipo') === 'retorno')
    .flush(leiautes.retorno ?? LEIAUTES_DE_RETORNO);
}

/** A tela aberta, com a leitura inicial respondida e a edição escolhida, quando pedida. */
export interface TelaAberta {
  readonly fixture: ComponentFixture<NotasDoEnemPage>;
  readonly host: HTMLElement;
}

export async function abrirTela(
  controller: HttpTestingController,
  processoLido: ProcessoSeletivoDto = processo(),
  leiautes: { envio?: readonly LeiauteDoInepDto[]; retorno?: readonly LeiauteDoInepDto[] } = {},
  publicada: SnapshotVigenteDto | null = snapshotVigente(),
): Promise<TelaAberta> {
  const fixture = TestBed.createComponent(NotasDoEnemPage);
  fixture.detectChanges();
  await responderALeituraInicial(controller, processoLido, leiautes, publicada);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

/** Cada card tem a própria edição e lê só o histórico dela: envios no envio, lotes na importação. */
export type Card = 'envio' | 'retorno';

const ROTA_DO_HISTORICO: Record<Card, string> = {
  envio: 'envios-ao-inep',
  retorno: 'lotes-de-notas',
};

/** Escolhe (ou troca) a edição no select do card e responde o histórico dela, vazio por padrão. */
export async function escolherEdicao(
  controller: HttpTestingController,
  { fixture, host }: TelaAberta,
  card: Card,
  edicao = '2025',
  historico: readonly object[] = [],
): Promise<void> {
  const select = host.querySelector<HTMLSelectElement>(`#notas-edicao-${card}`);
  if (select === null) throw new Error('O seletor de edição não foi renderizado.');
  select.value = edicao;
  select.dispatchEvent(new Event('change'));
  const rota = ROTA_EDICAO.replace(/\/2025$/, `/${edicao}`);
  controller.expectOne(`${rota}/${ROTA_DO_HISTORICO[card]}`).flush(historico);
  await fixture.whenStable();
  fixture.detectChanges();
}

export function trocarEdicao(
  controller: HttpTestingController,
  tela: TelaAberta,
  card: Card,
  edicao: string,
): Promise<void> {
  return escolherEdicao(controller, tela, card, edicao);
}
