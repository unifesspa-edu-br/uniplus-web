import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BUSCA_DE_MUNICIPIOS,
  type MunicipioEncontrado,
} from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP } from '../endereco-geo/endereco-geo.model';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type {
  CampoRenderizavel,
  FormularioDoCandidato,
  GrupoRenderizavel,
  RespostaFixa,
} from './formulario-do-candidato.model';
import type {
  GrupoDasRegras,
  ItemDasRegras,
  ValorJson,
} from './interpretador/regras-do-formulario';
import type { MunicipiosGravados } from './valor-de-municipio-gravado';

/** A Revisão e aceite resume o pedido do Fator de Atenuação (UNI-REQ-0150) com os rótulos do formulário. */
export const SOLICITA_O_FATOR = 'PEDE_BENEFICIO_X';
export const CAMINHO_DO_FATOR = 'VINCULO_BENEFICIO_X';
export const MUNICIPIO_DO_FATOR = 'CIDADE_BENEFICIO_X';
export const FATO_FORA_DO_FATOR = 'OUTRA_PERGUNTA';
export const MESES_NA_AREA = 'MESES_NA_AREA';
export const ATIVIDADES_NA_AREA = 'ATIVIDADES_NA_AREA';
export const DATA_INICIO_NA_AREA = 'DATA_INICIO_NA_AREA';
export const TELEFONE_DO_CONTATO = 'TELEFONE_DO_CONTATO';

const ETAPA_DO_FATOR_NAS_REGRAS = 'Inscricao:FATOR';

const FATOS_COM_O_FATOR = [
  SOLICITA_O_FATOR,
  CAMINHO_DO_FATOR,
  MUNICIPIO_DO_FATOR,
  FATO_FORA_DO_FATOR,
  MESES_NA_AREA,
  ATIVIDADES_NA_AREA,
  DATA_INICIO_NA_AREA,
  TELEFONE_DO_CONTATO,
];

const DEPENDENCIAS_PADRAO = {
  fatos: [MUNICIPIO_DO_FATOR, SOLICITA_O_FATOR, CAMINHO_DO_FATOR].sort(),
  grupos: [],
};

const ETAPAS_DO_FATOR: FormularioDoCandidato['etapas'] = [
  {
    codigo: 'FATOR',
    codigoNasRegras: ETAPA_DO_FATOR_NAS_REGRAS,
    ordem: 0,
    tipo: 'SECAO',
    titulo: 'Fator de Atenuação',
  },
  {
    codigo: 'REVISAO',
    codigoNasRegras: null,
    ordem: 1,
    tipo: 'BLOCO',
    bloco: 'REVISAO_E_ACEITE',
    titulo: 'Revisão e aceite',
  },
];

const CAMPOS_DO_FATOR: CampoRenderizavel[] = [
  {
    fatoCodigo: SOLICITA_O_FATOR,
    ordem: 0,
    rotulo: 'Deseja solicitar o Fator?',
    tipoRenderizacao: 'BOOLEANO',
  },
  {
    fatoCodigo: CAMINHO_DO_FATOR,
    ordem: 1,
    rotulo: 'Por qual vínculo com a área você solicita o Fator?',
    tipoRenderizacao: 'SELECAO_UNICA',
    valoresSelecionaveis: [
      { codigo: 'RESIDENCIA', descricao: 'Residência no período do edital', ordem: 0 },
      { codigo: 'ENSINO_MEDIO', descricao: 'Ensino médio cursado na área', ordem: 1 },
    ],
  },
  {
    fatoCodigo: MUNICIPIO_DO_FATOR,
    ordem: 2,
    rotulo: 'Em qual município você residiu?',
    tipoRenderizacao: 'SELECAO_UNICA',
    valoresSelecionaveis: [{ codigo: '2105302', descricao: 'Imperatriz — MA', ordem: 0 }],
  },
  { fatoCodigo: MESES_NA_AREA, ordem: 4, rotulo: 'Meses na área', tipoRenderizacao: 'NUMERO' },
  {
    fatoCodigo: ATIVIDADES_NA_AREA,
    ordem: 5,
    rotulo: 'Atividades na área',
    tipoRenderizacao: 'SELECAO_MULTIPLA',
    valoresSelecionaveis: [
      { codigo: 'PESCA', descricao: 'Pesca artesanal', ordem: 0 },
      { codigo: 'ROCA', descricao: 'Roça de subsistência', ordem: 1 },
    ],
  },
  { fatoCodigo: DATA_INICIO_NA_AREA, ordem: 6, rotulo: 'Início na área', tipoRenderizacao: 'DATA' },
  {
    fatoCodigo: TELEFONE_DO_CONTATO,
    ordem: 7,
    rotulo: 'Telefone de contato',
    tipoRenderizacao: 'TEXTO',
    formato: 'TELEFONE',
  },
];

const CAMPO_FORA_DO_FATOR: CampoRenderizavel = {
  fatoCodigo: FATO_FORA_DO_FATOR,
  ordem: 3,
  rotulo: 'Outra pergunta',
  tipoRenderizacao: 'TEXTO',
};

const GRUPO_DA_FAMILIA: GrupoRenderizavel = {
  codigo: 'FAMILIA',
  ordem: 0,
  rotulo: 'Integrante da família',
  minimo: 0,
  maximo: 3,
  incluiCandidato: false,
  subitens: [
    { fatoCodigo: 'RENDA', ordem: 0, rotulo: 'Renda', tipoRenderizacao: 'NUMERO' },
    { fatoCodigo: 'NOME', ordem: 1, rotulo: 'Nome', tipoRenderizacao: 'TEXTO' },
    { fatoCodigo: 'BONUS', ordem: 2, rotulo: 'Bônus', tipoRenderizacao: 'NUMERO' },
  ],
};

/** O bônus só aparece quando a renda é 999, valor que nenhuma ocorrência dos testes informa. */
const REGRA_DO_GRUPO_DA_FAMILIA: GrupoDasRegras = {
  codigo: 'FAMILIA',
  obrigatoriedade: 'SEMPRE',
  minimo: 0,
  maximo: 3,
  incluiCandidato: false,
  subitens: [
    { fatoCodigo: 'RENDA', obrigatoriedade: 'SEMPRE', restricoes: [] },
    { fatoCodigo: 'NOME', obrigatoriedade: 'SEMPRE', restricoes: [] },
    {
      fatoCodigo: 'BONUS',
      obrigatoriedade: 'SEMPRE',
      restricoes: [],
      exibicao: [[{ fato: 'RENDA', operador: 'IGUAL', valor: 999 }]],
    },
  ],
};

/** O caminho e o município só aparecem com o Fator pedido. */
const regraDoItem = (fatoCodigo: string): ItemDasRegras => ({
  fatoCodigo,
  obrigatoriedade: 'SEMPRE',
  restricoes: [],
  ...(fatoCodigo === CAMINHO_DO_FATOR || fatoCodigo === MUNICIPIO_DO_FATOR
    ? { exibicao: [[{ fato: SOLICITA_O_FATOR, operador: 'IGUAL', valor: true }]] }
    : {}),
});

const formularioDaInscricao = (
  fatosColetados: CampoRenderizavel[],
  fatosDaEtapa: string[],
  dependenciasDoFator: FormularioDoCandidato['dependenciasDoFator'],
): FormularioDoCandidato => ({
  finalidade: 'INSCRICAO',
  etapas: ETAPAS_DO_FATOR,
  termos: [],
  grupos: [],
  dependenciasDoFator,
  fatosColetados,
  regras: {
    etapas: [{ codigo: ETAPA_DO_FATOR_NAS_REGRAS, itens: fatosDaEtapa.map(regraDoItem) }],
  },
});

export const formularioComOFator = (
  dependencias: FormularioDoCandidato['dependenciasDoFator'] = DEPENDENCIAS_PADRAO,
): FormularioDoCandidato =>
  formularioDaInscricao([...CAMPOS_DO_FATOR, CAMPO_FORA_DO_FATOR], FATOS_COM_O_FATOR, dependencias);

export const formularioSemOFator = (): FormularioDoCandidato =>
  formularioDaInscricao(
    [{ fatoCodigo: 'EMAIL', ordem: 0, rotulo: 'E-mail', tipoRenderizacao: 'TEXTO' }],
    ['EMAIL'],
    DEPENDENCIAS_PADRAO,
  );

/** Troca a seleção do município pela busca, que só traz o código quando o nome não foi carregado. */
export const comMunicipioPorBusca = (base: FormularioDoCandidato): FormularioDoCandidato => ({
  ...base,
  fatosColetados: base.fatosColetados.map(
    (campo): CampoRenderizavel =>
      campo.fatoCodigo === MUNICIPIO_DO_FATOR
        ? { ...campo, valoresSelecionaveis: undefined, tipoRenderizacao: 'MUNICIPIO' }
        : campo,
  ),
});

/** Acrescenta ao formulário um grupo de integrantes, na seção do Fator, com um subitem numérico. */
export const comOGrupo = (base: FormularioDoCandidato): FormularioDoCandidato => ({
  ...base,
  grupos: [GRUPO_DA_FAMILIA],
  regras: {
    etapas: [
      {
        codigo: ETAPA_DO_FATOR_NAS_REGRAS,
        itens: base.regras.etapas?.[0]?.itens ?? [],
        grupos: [REGRA_DO_GRUPO_DA_FAMILIA],
      },
    ],
  },
});

/** O que a pessoa já preencheu ao abrir a inscrição: as entradas do componente que o carregam. */
export interface PreenchimentoDaInscricao {
  respostas: Record<string, ValorJson>;
  grupos?: Record<string, { id: string; respostas: Record<string, ValorJson> }[]>;
  fixas?: Record<string, RespostaFixa>;
}

export class CenarioDaRevisaoDoFator {
  gravados: MunicipiosGravados = {};
  achadosPelaBusca: readonly MunicipioEncontrado[] = [];
  fixture!: ComponentFixture<FormularioDoCandidatoComponent>;
  tela!: HTMLElement;

  static preparar(): CenarioDaRevisaoDoFator {
    const cenario = new CenarioDaRevisaoDoFator();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () => of({ ok: true, data: cenario.achadosPelaBusca }),
        },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
      ],
    });
    return cenario;
  }

  abrir(formulario: FormularioDoCandidato, preenchimento: PreenchimentoDaInscricao): void {
    this.fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    this.fixture.componentRef.setInput('formulario', formulario);
    this.fixture.componentRef.setInput('respostasFixas', preenchimento.fixas ?? {});
    this.fixture.componentRef.setInput('municipiosGravados', this.gravados);
    this.fixture.componentRef.setInput('inicial', {
      respostas: preenchimento.respostas,
      grupos: preenchimento.grupos ?? {},
      etapasConcluidas: [],
      pressupostos: {},
      envio: {},
    });
    this.fixture.detectChanges();
    this.tela = this.fixture.nativeElement as HTMLElement;
  }

  abrirNaRevisao(formulario: FormularioDoCandidato, preenchimento: PreenchimentoDaInscricao): void {
    this.abrir(formulario, preenchimento);
    this.irParaARevisao();
  }

  irParaARevisao(): void {
    const revisao = [...this.tela.querySelectorAll('ui-steps .ui-steps__botao')].find((botao) =>
      botao.textContent?.includes('Revisão e aceite'),
    ) as HTMLButtonElement;
    revisao.click();
    this.fixture.detectChanges();
  }

  resumo(): HTMLElement | null {
    return this.tela.querySelector('ui-fator-de-atenuacao-da-inscricao');
  }

  encerrar(): void {
    vi.useRealTimers();
  }
}
