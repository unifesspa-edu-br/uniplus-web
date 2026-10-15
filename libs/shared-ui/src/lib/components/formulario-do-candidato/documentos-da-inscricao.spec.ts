import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP } from '../endereco-geo/endereco-geo.model';

import type { DocumentoAvaliado, DocumentosAvaliados } from './documentos-avaliados';
import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import type { AvaliacaoNaTela } from './modalidades-avaliadas';

/**
 * O bloco de documentos mostra o que a avaliação da API pede nesta fase (ADR-0143) e leva às perguntas
 * que decidem os que ainda podem ser exigidos.
 */
const FASE = 'fase-da-inscricao';
const FORMULARIO: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  faseId: FASE,
  etapas: [
    {
      codigo: 'RESERVA',
      codigoNasRegras: 'Inscricao:RESERVA',
      ordem: 0,
      tipo: 'SECAO',
      titulo: 'Reserva de vagas',
    },
    {
      codigo: 'DOCUMENTOS',
      codigoNasRegras: null,
      ordem: 1,
      tipo: 'BLOCO',
      bloco: 'COMPROVACAO_DOCUMENTAL',
      titulo: 'Documentos',
    },
  ],
  termos: [],
  grupos: [],
  fatosColetados: [
    {
      fatoCodigo: 'PCD',
      ordem: 0,
      rotulo: 'Você é pessoa com deficiência?',
      tipoRenderizacao: 'TEXTO',
    },
  ],
  regras: {
    etapas: [
      {
        codigo: 'Inscricao:RESERVA',
        itens: [{ fatoCodigo: 'PCD', obrigatoriedade: 'SEMPRE', restricoes: [] }],
      },
    ],
  },
  dependenciasDaAvaliacao: { fatos: ['PCD'], grupos: [] },
};

const SEM_DOCUMENTOS = 'Você não envia documentos nesta etapa.';

const documento = (nome: string, outros: Partial<DocumentoAvaliado> = {}): DocumentoAvaliado => ({
  exigenciaId: `exigencia-${nome}`,
  nome,
  obrigatorio: true,
  finalidade: 'INSCRICAO',
  formatos: { qualquer: true, lista: null },
  modelo: null,
  situacao: 'EXIGIDO',
  grupoCodigo: null,
  ocorrenciaId: null,
  grupos: [],
  repetePorEntidade: null,
  ...outros,
});

const naTela = (
  documentos: DocumentosAvaliados | null,
  outros: Partial<AvaliacaoNaTela> = {},
): AvaliacaoNaTela => ({
  modalidades: null,
  documentos,
  calculando: false,
  erro: null,
  ...outros,
});
const nestaFase = (...documentos: DocumentoAvaliado[]): DocumentosAvaliados => ({
  fases: [{ faseId: FASE, codigo: 'INSCRICAO', ordem: 1, documentos, pendencias: [] }],
});
const PENDENCIA_PCD = {
  fatoCodigo: 'PCD',
  rotulo: 'Você é pessoa com deficiência?',
  secaoCodigo: 'Inscricao:RESERVA',
};

describe('Bloco de documentos da inscrição', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
      ],
    });
  });

  const montar = (avaliacao: AvaliacaoNaTela | null): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', FORMULARIO);
    fixture.componentRef.setInput('semDocumentos', SEM_DOCUMENTOS);
    fixture.componentRef.setInput('documentos', [
      {
        rotulo: 'Lista do certame',
        aplicabilidade: 'GERAL',
        obrigatorio: true,
        formatos: { qualquer: true, lista: null },
        modelo: null,
      },
    ]);
    fixture.componentRef.setInput('avaliacao', avaliacao);
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const passo = [...tela.querySelectorAll<HTMLButtonElement>('ui-steps .ui-steps__botao')].find(
      (b) => b.textContent?.includes('Documentos'),
    ) as HTMLButtonElement;
    passo.click();
    fixture.detectChanges();
    return tela;
  };
  const bloco = (tela: HTMLElement): HTMLElement =>
    tela.querySelector('ui-documentos-da-inscricao') as HTMLElement;
  const nomes = (tela: HTMLElement): string[] =>
    [...bloco(tela).querySelectorAll('h4')].map((h) => h.textContent?.trim() ?? '');

  it('com avaliação, lista o que ela pede, e não a lista do certame', () => {
    const tela = montar(
      naTela(nestaFase(documento('Laudo médico', { situacao: 'PODE_SER_EXIGIDO' }))),
    );

    expect(nomes(tela)).toEqual(['Laudo médico']);
    expect(bloco(tela).textContent).toContain('Pode ser exigido, conforme as respostas');
    expect(tela.textContent).not.toContain('Lista do certame');
  });

  it('sem nada pedido nesta fase, mantém o aviso de quem hospeda', () => {
    const tela = montar(naTela(nestaFase()));

    expect(bloco(tela).textContent).toContain(SEM_DOCUMENTOS);
  });

  it('as alternativas aparecem como escolha', () => {
    const identidade = { grupoId: 'identidade', tipo: 'OU', minimo: 1, repetePorEntidade: null };
    const conjunto = { grupoId: 'conjunto', tipo: 'E', minimo: null, repetePorEntidade: null };
    const tela = montar(
      naTela(
        nestaFase(
          documento('RG', { grupos: [identidade] }),
          documento('CNH', { grupos: [identidade, conjunto] }),
          documento('Comprovante', { grupos: [identidade, conjunto] }),
        ),
      ),
    );

    const escolha = bloco(tela).querySelector<HTMLElement>(
      'ul[aria-labelledby="documentos-identidade"]',
    ) as HTMLElement;
    expect(document.getElementById('documentos-identidade')?.textContent).toContain(
      'Envie uma das opções abaixo, à sua escolha:',
    );
    expect(escolha.querySelectorAll(':scope > li')).toHaveLength(2);
    const juntos = escolha.querySelector<HTMLElement>(
      'ul[aria-labelledby="documentos-conjunto"]',
    ) as HTMLElement;
    expect([...juntos.querySelectorAll('h4')].map((h) => h.textContent?.trim())).toEqual([
      'CNH',
      'Comprovante',
    ]);
  });

  it('a pergunta pendente leva o foco ao campo dela, na seção dela', async () => {
    const tela = montar(
      naTela({
        fases: [
          {
            ...nestaFase(documento('Laudo médico', { situacao: 'PODE_SER_EXIGIDO' })).fases[0],
            pendencias: [PENDENCIA_PCD],
          },
        ],
      }),
    );

    const atalho = [...bloco(tela).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Você é pessoa com deficiência?'),
    ) as HTMLButtonElement;
    atalho.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tela.querySelector('h3')?.textContent).toContain('Reserva de vagas');
    expect(document.activeElement).toBe(tela.querySelector('[data-campo="PCD"] input'));
  });

  it('a pendência de outra fase não aparece nesta', () => {
    const tela = montar(
      naTela({
        fases: [
          ...nestaFase().fases,
          {
            faseId: 'outra-fase',
            codigo: 'HABILITACAO',
            ordem: 2,
            documentos: [],
            pendencias: [PENDENCIA_PCD],
          },
        ],
      }),
    );

    expect(bloco(tela).textContent).not.toContain('Você é pessoa com deficiência?');
    expect(bloco(tela).textContent).toContain(SEM_DOCUMENTOS);
  });

  it('calculando, mantém a lista e marca o bloco ocupado; com erro, oferece tentar de novo', () => {
    const lista = nestaFase(documento('Histórico'));
    const tela = montar(naTela(lista, { calculando: true }));

    expect(bloco(tela).getAttribute('aria-busy')).toBe('true');
    expect(nomes(tela)).toEqual(['Histórico']);

    fixture.componentRef.setInput(
      'avaliacao',
      naTela(lista, { erro: 'Não foi possível atualizar agora.' }),
    );
    fixture.detectChanges();
    expect(bloco(tela).textContent).toContain('Não foi possível atualizar agora.');
    expect(
      [...bloco(tela).querySelectorAll('button')].some((b) =>
        b.textContent?.includes('Tentar de novo'),
      ),
    ).toBe(true);
  });

  it('a mudança só dos documentos não repete o anúncio das modalidades', () => {
    const ampla = { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 };
    const modalidades = (...itens: (typeof ampla)[]) => ({
      derivada: true,
      situacao: 'CONCORRE',
      itens,
      pendencias: [],
    });
    // A mesma avaliação das modalidades nas duas leituras: só os documentos mudam.
    const concorrendo = modalidades(ampla);
    const tela = montar(naTela(nestaFase(documento('Histórico')), { modalidades: modalidades() }));
    fixture.componentRef.setInput(
      'avaliacao',
      naTela(nestaFase(documento('Histórico')), { modalidades: concorrendo }),
    );
    fixture.detectChanges();

    fixture.componentRef.setInput(
      'avaliacao',
      naTela(nestaFase(documento('Laudo médico')), { modalidades: concorrendo }),
    );
    fixture.detectChanges();

    const regioes = [...tela.querySelectorAll('[aria-live="polite"]')].map((r) => r.textContent);
    expect(regioes).toContain(
      'Passou a ser exigido: Laudo médico. Deixou de ser exigido: Histórico.',
    );
    expect(regioes.join(' ')).not.toContain('concorrer');
  });

  it('a mudança do que é exigido é anunciada, sem levar o foco', () => {
    const tela = montar(naTela(nestaFase(documento('Histórico'))));
    const foco = document.activeElement;

    fixture.componentRef.setInput('avaliacao', naTela(nestaFase(documento('Laudo médico'))));
    fixture.detectChanges();

    const regioes = [...tela.querySelectorAll('[aria-live="polite"]')].map((r) => r.textContent);
    expect(regioes).toContain(
      'Passou a ser exigido: Laudo médico. Deixou de ser exigido: Histórico.',
    );
    expect(document.activeElement).toBe(foco);
  });
});
