import { type ComponentFixture } from '@angular/core/testing';

import type { ArquivoDoDocumento } from './documentos-avaliados';
import {
  arquivoVerificado,
  bloco,
  configurarOBloco,
  documento,
  entradasDoBloco,
  FORMULARIO,
  montarOBloco,
  naTela,
  nestaFase,
  nomes,
  PENDENCIA_PCD,
  SEM_DOCUMENTOS,
} from './documentos-da-inscricao.testing';
import type { EnvioDeDocumentos } from './envio-de-documentos';
import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { apresentacaoDaPagina } from './formularios-de-exemplo.testing';
import type { AvaliacaoNaTela } from './modalidades-avaliadas';

describe('Bloco de documentos da inscrição', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;

  beforeEach(configurarOBloco);

  const montar = (
    avaliacao: AvaliacaoNaTela | null,
    envioDeDocumentos: EnvioDeDocumentos | null = null,
    ocorrenciasGravadas: ReadonlySet<string> | null = null,
    formulario: FormularioDoCandidato = FORMULARIO,
  ): HTMLElement => {
    const entradas = entradasDoBloco(avaliacao, envioDeDocumentos, ocorrenciasGravadas);
    fixture = montarOBloco(entradas, formulario);
    return fixture.nativeElement as HTMLElement;
  };

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
      situacao: 'EM_VERIFICACAO',
      mensagem: 'Arquivo em verificação. Isso costuma levar poucos segundos.',
    };
    const AVISO =
      'Aguarde a verificação completa dos documentos obrigatórios para enviar a inscrição.';
    /** Os documentos antes de outra seção, para haver para onde avançar. */
    const DOCUMENTOS_E_CONTATO: FormularioDoCandidato = {
      ...FORMULARIO,
      paginas: [
        FORMULARIO.paginas[1],
        {
          codigo: 'FIM',
          codigoNasRegras: null,
          ordem: 2,
          tipo: 'BLOCO',
          bloco: 'REVISAO_E_ACEITE',
          apresentacao: apresentacaoDaPagina('Revisão'),
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
    const identidade = {
      grupoId: 'identidade',
      forma: { codigo: 'QUANTIDADE_MINIMA_DE_ITENS', rotulo: 'Quantidade mínima' },
      minimo: 1,
      grupoDoFormularioParaRepeticao: null,
    };
    const conjunto = {
      grupoId: 'conjunto',
      forma: { codigo: 'TODOS_OS_ITENS', rotulo: 'Todos estes itens' },
      minimo: null,
      grupoDoFormularioParaRepeticao: null,
    };
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
