import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP } from '../endereco-geo/endereco-geo.model';

import type {
  ArquivoDoDocumento,
  DocumentoAvaliado,
  DocumentosAvaliados,
} from './documentos-avaliados';
import type { EnvioDeDocumentos } from './envio-de-documentos';
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
  situacao: 'PENDENTE',
  grupoCodigo: null,
  ocorrenciaId: null,
  grupos: [],
  repetePorEntidade: null,
  formatosAceitos: ['PDF'],
  tamanhoMaximoBytes: 2 * 1024 * 1024,
  quantidadeMinima: 1,
  arquivos: [],
  ...outros,
});

const arquivoVerificado = (arquivoId: string): ArquivoDoDocumento => ({
  arquivoId,
  apresentacaoId: `apresentacao-${arquivoId}`,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 2048,
  situacao: 'verificado',
  mensagem: null,
  rotulo: 'Arquivo 1',
  confirmadoEm: '2026-10-22T12:33:00Z',
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

  const montar = (
    avaliacao: AvaliacaoNaTela | null,
    envioDeDocumentos: EnvioDeDocumentos | null = null,
    ocorrenciasGravadas: ReadonlySet<string> | null = null,
    formulario: FormularioDoCandidato = FORMULARIO,
  ): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', formulario);
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
    fixture.componentRef.setInput('envioDeDocumentos', envioDeDocumentos);
    fixture.componentRef.setInput('ocorrenciasGravadas', ocorrenciasGravadas);
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

  describe('com documento obrigatório em verificação', () => {
    const emVerificacao: ArquivoDoDocumento = {
      ...arquivoVerificado('a1'),
      tamanhoBytes: null,
      situacao: 'emVerificacao',
      mensagem: 'Arquivo em verificação. Isso costuma levar poucos segundos.',
    };
    const AVISO =
      'Aguarde a verificação completa dos documentos obrigatórios para enviar a inscrição.';
    /** Os documentos antes de outra seção, para haver para onde avançar. */
    const DOCUMENTOS_E_CONTATO: FormularioDoCandidato = {
      ...FORMULARIO,
      etapas: [
        FORMULARIO.etapas[1],
        {
          codigo: 'FIM',
          codigoNasRegras: null,
          ordem: 2,
          tipo: 'BLOCO',
          bloco: 'REVISAO_E_ACEITE',
          titulo: 'Revisão',
        },
      ],
    };
    const proximaSecao = (tela: HTMLElement): HTMLButtonElement =>
      [...tela.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Próxima seção'),
      ) as HTMLButtonElement;
    const tentarAvancar = (arquivos: readonly ArquivoDoDocumento[], obrigatorio = true) => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico', { obrigatorio, arquivos }))),
        null,
        null,
        DOCUMENTOS_E_CONTATO,
      );
      fixture.componentRef.setInput('exigirSecaoValida', true);
      fixture.detectChanges();
      proximaSecao(tela).click();
      fixture.detectChanges();
      return tela;
    };

    it('não avança e diz que é preciso aguardar', () => {
      const tela = tentarAvancar([emVerificacao]);

      expect(bloco(tela)).not.toBeNull();
      expect(bloco(tela).textContent).toContain(AVISO);
      expect(tela.textContent).toContain(AVISO);
      expect(tela.querySelector('ui-steps [aria-current="step"]')?.textContent).toContain(
        'Documentos',
      );
    });

    it('avança quando o arquivo da mesma apresentação já foi verificado', () => {
      const tela = tentarAvancar(
        [emVerificacao, arquivoVerificado('a2')].map((a, i) => ({
          ...a,
          apresentacaoId: 'apresentacao-unica',
          arquivoId: `a${i}`,
        })),
      );

      expect(bloco(tela)).toBeNull();
      expect(tela.textContent).not.toContain(AVISO);
    });

    it('o documento opcional em verificação não impede de avançar', () => {
      const tela = tentarAvancar([emVerificacao], false);

      expect(bloco(tela)).toBeNull();
    });
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

  describe('envio do arquivo exigido', () => {
    const ENVIO: EnvioDeDocumentos = {
      arquivos: signal([]),
      mudancas: signal(0),
      ocupado: signal(false),
      enviar: vi.fn(),
      remover: vi.fn(),
      baixar: vi.fn(),
    };

    it('oferece o envio só para o que as respostas já exigem', () => {
      const tela = montar(
        naTela(
          nestaFase(
            documento('Laudo médico'),
            documento('Histórico', { situacao: 'PODE_SER_EXIGIDO' }),
          ),
        ),
        ENVIO,
      );

      const campos = [...bloco(tela).querySelectorAll('ui-envio-do-documento label')];
      expect(campos.map((c) => c.textContent?.trim())).toEqual(['Enviar Laudo médico']);
    });

    it('usa o que a avaliação informa da exigência: situação, arquivos, formatos, limite e mínimo', () => {
      const tela = montar(
        naTela(
          nestaFase(
            documento('Laudo médico', {
              situacao: 'SATISFEITA',
              formatosAceitos: ['PDF', 'JPEG'],
              tamanhoMaximoBytes: 3 * 1024 * 1024,
              quantidadeMinima: 2,
              arquivos: [arquivoVerificado('a1')],
            }),
            documento('Atestado', { situacao: 'PENDENTE' }),
          ),
        ),
        ENVIO,
      );

      const [laudo, atestado] = [...bloco(tela).querySelectorAll('ui-envio-do-documento')];
      expect(laudo.querySelector('ui-tag')?.textContent?.trim()).toBe('Satisfeita');
      expect(atestado.querySelector('ui-tag')?.textContent?.trim()).toBe('Pendente');
      expect(laudo.querySelector('.uni-uploader__item-name')?.textContent).toContain(
        'Arquivo 1',
      );
      expect(laudo.textContent).toContain('Envie 2 arquivos');
      expect(laudo.textContent).toContain('PDF, JPG - tamanho máximo: 3MB');
      expect(laudo.closest('li')?.querySelector('.lista-de-documentos__meta')?.textContent).toMatch(
        /·\s*PDF, JPG\s*$/u,
      );
    });

    it('enquanto não se sabe a quais integrantes o documento se liga, não oferece envio', () => {
      const tela = montar(
        naTela(
          nestaFase(
            documento('Laudo médico', { grupoCodigo: 'MEMBROS', repetePorEntidade: 'MEMBROS' }),
          ),
        ),
        ENVIO,
      );

      expect(bloco(tela).querySelector('h4')).not.toBeNull();
      expect(bloco(tela).querySelector('ui-envio-do-documento')).toBeNull();
    });

    it('ocorrência que o rascunho ainda não gravou pede salvar antes de enviar', () => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico', { ocorrenciaId: 'o1' }))),
        ENVIO,
        new Set(),
      );

      expect(bloco(tela).querySelector('ui-envio-do-documento')).toBeNull();
      expect(bloco(tela).textContent).toContain('Salve o rascunho para enviar o arquivo');
    });

    it('a recusa por documento obrigatório ausente leva ao passo Documentos, ao envio da exigência, com o erro nele', async () => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico'), documento('Atestado'))),
        ENVIO,
      );
      const primeiroPasso = tela.querySelector<HTMLButtonElement>('ui-steps .ui-steps__botao');
      primeiroPasso?.click();
      fixture.detectChanges();
      expect(bloco(tela)).toBeNull();

      fixture.componentRef.setInput('errosDoServidor', [
        {
          campo: 'documentos.exigencia-Atestado',
          mensagem: 'Envie este documento, ou uma das alternativas da lista, para concluir.',
        },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const envio = bloco(tela).querySelector('[data-campo="documentos.exigencia-Atestado"]');
      expect(envio?.contains(document.activeElement)).toBe(true);
      expect(envio?.textContent).toContain(
        'Envie este documento, ou uma das alternativas da lista, para concluir.',
      );
      expect(tela.textContent).toContain('O servidor recusou 1 resposta desta seção');
      expect(
        bloco(tela).querySelector('[data-campo="documentos.exigencia-Laudo médico"]')?.textContent,
      ).not.toContain('Envie este documento, ou uma das alternativas da lista, para concluir.');
    });

    it('a recusa de uma exigência some quando a avaliação a dá por atendida', async () => {
      const tela = montar(naTela(nestaFase(documento('Atestado'))), ENVIO);
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'documentos.exigencia-Atestado', mensagem: 'Documento ausente.' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(bloco(tela).querySelector('[role="alert"]')?.textContent).toContain(
        'Documento ausente.',
      );

      fixture.componentRef.setInput(
        'avaliacao',
        naTela(nestaFase(documento('Atestado', { situacao: 'SATISFEITA' }))),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    it('a recusa continua enquanto a exigência com mais de um arquivo está pendente', async () => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico', { quantidadeMinima: 2 }))),
        ENVIO,
      );
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'documentos.exigencia-Laudo médico', mensagem: 'Documento ausente.' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput(
        'avaliacao',
        naTela(
          nestaFase(
            documento('Laudo médico', {
              quantidadeMinima: 2,
              arquivos: [arquivoVerificado('a1')],
            }),
          ),
        ),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).toContain('Documento ausente.');
    });

    it('a recusa de uma alternativa some quando o candidato atende o grupo "um ou outro" por outra', async () => {
      const identidade = { grupoId: 'identidade', tipo: 'OU', minimo: 1, repetePorEntidade: null };
      const tela = montar(
        naTela(
          nestaFase(
            documento('RG', { grupos: [identidade] }),
            documento('CNH', { grupos: [identidade] }),
          ),
        ),
        ENVIO,
      );
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'documentos.exigencia-RG', mensagem: 'Documento ausente.' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(tela.textContent).toContain('Documento ausente.');

      fixture.componentRef.setInput(
        'avaliacao',
        naTela(
          nestaFase(
            documento('RG', { grupos: [identidade] }),
            documento('CNH', { grupos: [identidade], situacao: 'SATISFEITA' }),
          ),
        ),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    const recusar = async (campo: string): Promise<void> => {
      fixture.componentRef.setInput('errosDoServidor', [{ campo, mensagem: 'Documento ausente.' }]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const reavaliar = async (avaliacao: AvaliacaoNaTela): Promise<void> => {
      fixture.componentRef.setInput('avaliacao', avaliacao);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('a recusa sai quando um grupo "um ou outro" externo está atendido, mesmo com o interno pendente', async () => {
      const externo = { grupoId: 'externo', tipo: 'OU', minimo: 1, repetePorEntidade: null };
      const interno = { grupoId: 'interno', tipo: 'OU', minimo: 1, repetePorEntidade: null };
      const docs = (passaporte: string) =>
        naTela(
          nestaFase(
            documento('RG', { grupos: [externo, interno] }),
            documento('CNH', { grupos: [externo, interno] }),
            documento('Passaporte', { grupos: [externo], situacao: passaporte }),
          ),
        );
      const tela = montar(docs('PENDENTE'), ENVIO);
      await recusar('documentos.exigencia-RG');
      expect(tela.textContent).toContain('Documento ausente.');

      await reavaliar(docs('SATISFEITA'));

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    it('a recusa de uma exigência que as respostas já não pedem sai com ela', async () => {
      const tela = montar(naTela(nestaFase(documento('Atestado'))), ENVIO);
      await recusar('documentos.exigencia-Atestado');
      expect(tela.textContent).toContain('O servidor recusou 1 resposta');

      await reavaliar(naTela(nestaFase(documento('Atestado', { situacao: 'PODE_SER_EXIGIDO' }))));

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    it('na simulação do administrador, que não envia, o bloco continua só a lista', () => {
      const tela = montar(naTela(nestaFase(documento('Laudo médico'))));

      expect(bloco(tela).querySelector('ui-envio-do-documento')).toBeNull();
    });
  });
});
