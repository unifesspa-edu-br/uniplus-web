import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  ExibicaoDoValorDoItemCodigo,
  FormaDoValorDoItemCodigo,
  type ComprovanteDaInscricaoDto,
} from '@uniplus/shared-data/selecao';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { ComprovanteDaInscricaoPage } from './comprovante-da-inscricao.page';

const forma = (
  codigo: FormaDoValorDoItemCodigo,
): { codigo: FormaDoValorDoItemCodigo; rotulo: string } => ({
  codigo,
  rotulo: codigo,
});
const exibicao = (
  codigo: ExibicaoDoValorDoItemCodigo,
): { codigo: ExibicaoDoValorDoItemCodigo; rotulo: string } => ({ codigo, rotulo: codigo });

const SEM_CABECALHOS = new HttpHeaders();

export const INSCRICAO_ID = '0199e000-0000-7000-8000-0000000000e1';
export const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
export const HASH = 'f0e1d2c3b4a5968778695a4b3c2d1e0f00112233445566778899aabbccddeeff';
export const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };

/** Fernanda Drumond, persona fictícia do portal de documentação. */
export const CPF_DA_CONTA = '69959836371';

/** O envio 2 de 2 (o que vale) de Fernanda Drumond, que prefere o nome social. */
export const COMPROVANTE_BASE: ComprovanteDaInscricaoDto = {
  inscricao: {
    inscricaoId: INSCRICAO_ID,
    numero: 2,
    total: 2,
    vale: true,
    numeroAnterior: 1,
    numeroSeguinte: null,
    envio: {
      numeroInscricao: '2027-000042',
      enviadoEm: '2026-12-11T13:30:00Z',
      fusoHorario: FUSO,
      hashIntegridade: 'a'.repeat(64),
    },
    cancelamento: null,
    prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: true },
  },
  processo: {
    processoSeletivoId: PROCESSO,
    nomeDoProcesso: 'Medicina 2027',
    identificadorDoProcesso: 'Edital 001/2026',
    unidadeAdministradora: 'Centro de Processos Seletivos',
  },
  candidato: {
    nomeCivil: 'Fernanda Laura Nicole Drumond',
    nomeSocial: 'Ariel Drumond',
    usaNomeSocial: true,
    cpfMascarado: '***.598.363-**',
  },
  escolhasDeCurso: {
    numeroDeOpcoesDeCurso: 1,
    opcoesDeCurso: [
      {
        ordem: 1,
        nome: 'Direito (Bacharelado) — Campus Marabá',
        modalidades: [
          { codigo: 'LI_EP', nome: 'Escola pública, independente de renda', ordem: 1 },
          { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 },
        ],
      },
    ],
  },
  formulario: {
    secoes: [
      {
        codigo: 'DADOS_BASICOS',
        titulo: 'Dados do candidato',
        itens: [
          {
            rotulo: 'Município de nascimento',
            descricao: '',
            tipo: forma(FormaDoValorDoItemCodigo.OPCAO),
            componente: exibicao(ExibicaoDoValorDoItemCodigo.PADRAO),
            valor: { codigo: '2927408', rotulo: 'Salvador' },
          },
          {
            rotulo: 'Data de nascimento',
            descricao: '',
            tipo: forma(FormaDoValorDoItemCodigo.DATA),
            componente: exibicao(ExibicaoDoValorDoItemCodigo.PADRAO),
            valor: '2001-03-09',
          },
        ],
        grupos: [
          {
            codigo: 'FAMILIA',
            rotulo: 'Composição familiar',
            ocorrencias: [
              {
                id: 'o1',
                titulo: 'Você (candidato)',
                itens: [
                  {
                    rotulo: 'Renda mensal',
                    descricao: '',
                    tipo: forma(FormaDoValorDoItemCodigo.NUMERO),
                    componente: exibicao(ExibicaoDoValorDoItemCodigo.MOEDA),
                    valor: '1234.5',
                  },
                ],
              },
              {
                id: 'o2',
                titulo: 'Integrante 1',
                itens: [
                  {
                    rotulo: 'Renda mensal',
                    descricao: '',
                    tipo: forma(FormaDoValorDoItemCodigo.NUMERO),
                    componente: exibicao(ExibicaoDoValorDoItemCodigo.MOEDA),
                    valor: '800',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    derivados: [
      {
        rotulo: 'Faixa etária',
        descricao: '',
        tipo: forma(FormaDoValorDoItemCodigo.TEXTO),
        componente: exibicao(ExibicaoDoValorDoItemCodigo.PADRAO),
        valor: '25 a 29 anos',
      },
    ],
    termosAceitos: [
      {
        codigo: 'VERACIDADE',
        nome: 'Declaração de veracidade',
        versaoId: 'v1',
        hashVersao: 'h1',
        formularioCodigo: 'INSCRICAO',
      },
    ],
    documentos: [],
  },
};

export function falha(
  status: number,
  code: string,
  title = 'Falha',
): ApiResult<ComprovanteDaInscricaoDto> {
  return apiFailure(
    { type: 'about:blank', title, status, code, traceId: '' },
    status,
    SEM_CABECALHOS,
  );
}

export const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));

export const links = (tela: HTMLElement): string[] =>
  Array.from(tela.querySelectorAll('nav a')).map((a) => a.textContent?.trim() ?? '');

export const hrefDe = (tela: HTMLElement, texto: string): string | null | undefined =>
  Array.from(tela.querySelectorAll('a'))
    .find((a) => a.textContent?.trim() === texto)
    ?.getAttribute('href');

/** A seção do comprovante pelo título dela. */
export const secao = (tela: HTMLElement, titulo: string): HTMLElement | null =>
  (Array.from(tela.querySelectorAll('ui-secao-de-documento')).find(
    (s) => s.querySelector('.secao-de-documento__titulo')?.textContent?.trim() === titulo,
  ) as HTMLElement | undefined) ?? null;

export const dado = (tela: Element, rotulo: string): string | null => {
  const par = Array.from(tela.querySelectorAll('dl > div')).find(
    (d) => d.querySelector('dt')?.textContent?.trim() === rotulo,
  );
  return par?.querySelector('dd')?.textContent?.trim().replace(/\s+/g, ' ') ?? null;
};

export const botaoDeTentar = (tela: HTMLElement): HTMLButtonElement | undefined =>
  Array.from(tela.querySelectorAll('button')).find(
    (botao) => botao.textContent?.trim() === 'Tentar novamente',
  );

/** O que cada teste muda em cada parte do comprovante-base. */
export interface AlteracoesDoComprovante {
  readonly candidato?: ComprovanteDaInscricaoDto['candidato'];
  readonly inscricao?: Partial<ComprovanteDaInscricaoDto['inscricao']>;
  readonly processo?: Partial<ComprovanteDaInscricaoDto['processo']>;
  readonly escolhasDeCurso?: Partial<ComprovanteDaInscricaoDto['escolhasDeCurso']>;
  readonly formulario?: Partial<ComprovanteDaInscricaoDto['formulario']>;
}

/** A página do comprovante aberta com o serviço de leitura e a conta do titular simulados. */
export class CenarioDoComprovante {
  /** O que cada teste muda no comprovante-base devolvido pelo serviço. */
  alteracoes: AlteracoesDoComprovante = {};
  readonly cpfDoLogin = signal(CPF_DA_CONTA);
  readonly servico = {
    comprovante: (_: string, numero: number): Observable<ApiResult<ComprovanteDaInscricaoDto>> =>
      of(apiOk(this.comprovante(numero), 200, SEM_CABECALHOS)),
  };
  fixture!: ComponentFixture<ComprovanteDaInscricaoPage>;

  static preparar(): CenarioDoComprovante {
    const cenario = new CenarioDoComprovante();
    cenario.configurar();
    return cenario;
  }

  encerrar(): void {
    vi.restoreAllMocks();
  }

  /** Descarta a página já aberta para abrir outra no mesmo teste. */
  reiniciar(): void {
    TestBed.resetTestingModule();
    this.configurar();
  }

  comprovante(numero = COMPROVANTE_BASE.inscricao.numero): ComprovanteDaInscricaoDto {
    const base = COMPROVANTE_BASE;
    const { candidato, ...grupos } = this.alteracoes;
    return {
      ...base,
      candidato: candidato ?? base.candidato,
      inscricao: { ...base.inscricao, ...grupos.inscricao, numero },
      processo: { ...base.processo, ...grupos.processo },
      escolhasDeCurso: { ...base.escolhasDeCurso, ...grupos.escolhasDeCurso },
      formulario: { ...base.formulario, ...grupos.formulario },
    };
  }

  async abrir(numero = '2'): Promise<HTMLElement> {
    this.fixture = TestBed.createComponent(ComprovanteDaInscricaoPage);
    this.fixture.componentRef.setInput('inscricaoId', INSCRICAO_ID);
    this.fixture.componentRef.setInput('numero', numero);
    await this.atualizar();
    return this.fixture.nativeElement as HTMLElement;
  }

  async trocarPara(numero: string): Promise<void> {
    this.fixture.componentRef.setInput('numero', numero);
    await this.atualizar();
  }

  async atualizar(): Promise<void> {
    this.fixture.detectChanges();
    await this.fixture.whenStable();
    this.fixture.detectChanges();
  }

  private configurar(): void {
    TestBed.configureTestingModule({
      imports: [ComprovanteDaInscricaoPage],
      providers: [
        provideRouter([]),
        { provide: MinhasInscricoesService, useValue: this.servico },
        { provide: UserContextService, useValue: { user: () => ({ cpf: this.cpfDoLogin() }) } },
      ],
    });
  }
}
