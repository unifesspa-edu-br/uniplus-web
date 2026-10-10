import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import type {
  CertamePublicadoDto,
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { ComprovanteDaInscricaoPage } from './comprovante-da-inscricao.page';

const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const SEM_CABECALHOS = new HttpHeaders();

const FORMULARIO = {
  etapas: [{ codigo: 'DADOS_BASICOS', ordem: 0, tipo: 'SECAO', titulo: 'Dados do candidato' }],
  fatosColetados: [
    {
      fatoCodigo: 'NOME',
      ordem: 0,
      rotulo: 'Nome completo',
      tipoRenderizacao: 'TEXTO',
      etapaCodigo: 'DADOS_BASICOS',
    },
    {
      fatoCodigo: 'DESEJA_NOME_SOCIAL',
      ordem: 1,
      rotulo: 'Deseja usar nome social?',
      tipoRenderizacao: 'BOOLEANO',
      etapaCodigo: 'DADOS_BASICOS',
    },
    {
      fatoCodigo: 'NOME_SOCIAL',
      ordem: 2,
      rotulo: 'Nome social',
      tipoRenderizacao: 'TEXTO',
      etapaCodigo: 'DADOS_BASICOS',
    },
  ],
  grupos: [],
  termos: [{ codigo: 'VERACIDADE', nome: 'Declaração de veracidade' }],
  pressupostos: [],
} as unknown as FormularioRenderizavelDto;

/** Fernanda Drumond, persona fictícia do portal de documentação, que prefere o nome social. */
function comprovante(numeroInscricao: string): ComprovanteInscricaoDto {
  return {
    cpfMascarado: '***.598.363-**',
    numeroInscricao,
    instante: '2026-12-11T13:30:00Z',
    hashIntegridade: 'a'.repeat(64),
    ofertaCursoId: null,
    respostas: {
      NOME: 'Fernanda Laura Nicole Drumond',
      DESEJA_NOME_SOCIAL: true,
      NOME_SOCIAL: 'Ariel Drumond',
    },
    derivados: {},
    grupos: {},
    aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
  };
}

const EMITIDOS = 2;
const servico = {
  comprovante: (_: string, numero: number) =>
    of(
      numero <= EMITIDOS
        ? apiOk({ numero, comprovante: comprovante('00000042') }, 200, SEM_CABECALHOS)
        : apiFailure(
            {
              type: 'about:blank',
              title: 'Não encontrado',
              status: 404,
              code: 'nao_encontrado',
              traceId: '',
            },
            404,
            SEM_CABECALHOS,
          ),
    ),
  comprovanteMaisRecente: () =>
    of(apiOk({ numero: EMITIDOS, comprovante: comprovante('00000042') }, 200, SEM_CABECALHOS)),
  formulario: () => of(apiOk(FORMULARIO, 200, SEM_CABECALHOS)),
  certame: () =>
    of({
      nome: 'Medicina 2027',
      identificadorLegivel: 'Edital 001/2026',
      ofertas: ['o1'],
    } as CertamePublicadoDto),
};

async function abrir(numero?: string): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [ComprovanteDaInscricaoPage],
    providers: [provideRouter([]), { provide: MinhasInscricoesService, useValue: servico }],
  });
  const fixture = TestBed.createComponent(ComprovanteDaInscricaoPage);
  fixture.componentRef.setInput('processoId', PROCESSO);
  if (numero) fixture.componentRef.setInput('numero', numero);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const links = (tela: HTMLElement): string[] =>
  [...tela.querySelectorAll('nav a')].map((a) => a.textContent?.trim() ?? '');

describe('ComprovanteDaInscricaoPage', () => {
  it('mostra o nome que o candidato prefere, só o CPF mascarado e as respostas com os rótulos do formulário (CA-01)', async () => {
    const tela = await abrir();

    expect(tela.textContent).toContain('Ariel Drumond');
    expect(tela.textContent).toContain('***.598.363-**');
    expect(tela.textContent).toContain('Nome completo');
    expect(tela.textContent).toContain('Declaração de veracidade');
  });

  it('o comprovante anterior leva ao seguinte, e o da última submissão leva ao anterior (CA-02)', async () => {
    expect(links(await abrir('1'))).toEqual([
      'Comprovante seguinte',
      'Voltar às minhas inscrições',
    ]);

    TestBed.resetTestingModule();
    expect(links(await abrir())).toEqual(['Comprovante anterior', 'Voltar às minhas inscrições']);
  });
});
