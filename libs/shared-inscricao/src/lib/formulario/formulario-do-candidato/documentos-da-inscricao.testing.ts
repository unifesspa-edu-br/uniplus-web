import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';
import { BUSCA_DE_CEP } from '@uniplus/shared-ui/components';

import type {
  ArquivoDoDocumento,
  DocumentoAvaliado,
  DocumentosAvaliados,
} from './documentos-avaliados';
import type { EnvioDeDocumentos } from './envio-de-documentos';
import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { FormularioDoCandidato, FormularioNoProcesso } from './formulario-do-candidato.model';
import {
  apresentacaoDaPagina,
  campoApresentado,
  itemDasRegras,
} from './formularios-de-exemplo.testing';
import type { AvaliacaoNaTela } from './modalidades-avaliadas';

export const FASE = 'fase-da-inscricao';
export const FORMULARIO: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  paginas: [
    {
      codigo: 'RESERVA',
      codigoNasRegras: 'Inscricao:RESERVA',
      ordem: 0,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaPagina('Reserva de vagas'),
    },
    {
      codigo: 'DOCUMENTOS',
      codigoNasRegras: null,
      ordem: 1,
      tipo: 'BLOCO',
      bloco: 'COMPROVACAO_DOCUMENTAL',
      apresentacao: apresentacaoDaPagina('Documentos'),
    },
  ],
  termos: [],
  coleta: {
    itens: [campoApresentado('PCD', 'Você é pessoa com deficiência?', 'TEXTO')],
    grupos: [],
  },
  pressupostos: { fatos: [] },
  regras: {
    paginas: [
      {
        codigo: 'Inscricao:RESERVA',
        itens: [itemDasRegras('PCD')],
      },
    ],
  },
};

export const NO_PROCESSO: FormularioNoProcesso = {
  faseId: FASE,
  dependenciasDaAvaliacao: { fatos: ['PCD'], grupos: [] },
};

export const SEM_DOCUMENTOS = 'Você não envia documentos nesta etapa.';

export { documento } from './documentos-avaliados.testing';

export const arquivoVerificado = (arquivoId: string): ArquivoDoDocumento => ({
  arquivoId,
  apresentacaoId: `apresentacao-${arquivoId}`,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 2048,
  situacao: 'VERIFICADO',
  mensagem: null,
  rotulo: 'Arquivo 1',
  confirmadoEm: '2026-10-22T12:33:00Z',
});

export const naTela = (
  documentos: DocumentosAvaliados | null,
  outros: Partial<AvaliacaoNaTela> = {},
): AvaliacaoNaTela => ({
  modalidades: null,
  documentos,
  calculando: false,
  erro: null,
  ...outros,
});
export const nestaFase = (...documentos: DocumentoAvaliado[]): DocumentosAvaliados => ({
  fases: [{ faseId: FASE, codigo: 'INSCRICAO', ordem: 1, documentos, pendencias: [] }],
});
export const PENDENCIA_PCD = {
  fatoCodigo: 'PCD',
  rotulo: 'Você é pessoa com deficiência?',
  secaoCodigo: 'Inscricao:RESERVA',
};

export const configurarOBloco = (): void => {
  TestBed.configureTestingModule({
    providers: [
      { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
      { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
    ],
  });
};

/** O formulário montado com a avaliação e o envio dados, no passo dos documentos. */
export const montarOBloco = (
  entradas: Readonly<Record<string, unknown>>,
  formulario: FormularioDoCandidato = FORMULARIO,
  noProcesso: FormularioNoProcesso = NO_PROCESSO,
): ComponentFixture<FormularioDoCandidatoComponent> => {
  const fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
  fixture.componentRef.setInput('formulario', formulario);
  fixture.componentRef.setInput('noProcesso', noProcesso);
  for (const [nome, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nome, valor);
  fixture.detectChanges();
  abrirOPassoDosDocumentos(fixture);
  return fixture;
};

const abrirOPassoDosDocumentos = (fixture: ComponentFixture<unknown>): void => {
  const passos = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
    'ui-steps .ui-steps__botao',
  );
  [...passos].find((b) => b.textContent?.includes('Documentos'))?.click();
  fixture.detectChanges();
};

const DOCUMENTO_DO_CERTAME = {
  rotulo: 'Lista do certame',
  aplicabilidade: 'GERAL',
  obrigatorio: true,
  formatos: { qualquer: true, lista: null },
  modelo: null,
};

/** As entradas do bloco: a avaliação, o envio e as ocorrências já gravadas. */
export const entradasDoBloco = (
  avaliacao: AvaliacaoNaTela | null,
  envioDeDocumentos: EnvioDeDocumentos | null,
  ocorrenciasGravadas: ReadonlySet<string> | null,
): Record<string, unknown> => ({
  semDocumentos: SEM_DOCUMENTOS,
  documentos: [DOCUMENTO_DO_CERTAME],
  avaliacao,
  envioDeDocumentos,
  ocorrenciasGravadas,
});

export const bloco = (tela: HTMLElement): HTMLElement =>
  tela.querySelector('insc-documentos-da-inscricao') as HTMLElement;

export const nomes = (tela: HTMLElement): string[] =>
  [...bloco(tela).querySelectorAll('h4')].map((h) => h.textContent?.trim() ?? '');
