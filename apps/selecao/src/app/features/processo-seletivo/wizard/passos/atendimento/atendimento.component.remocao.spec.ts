import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { AtendimentoPassoComponent } from './atendimento.component';
import {
  PCD_ID,
  ROTA_ATENDIMENTO,
  montarPassoDeAtendimento,
} from './atendimento.component.testing';

describe('AtendimentoPassoComponent — referências removidas e catálogo indisponível', () => {
  let componente: AtendimentoPassoComponent;
  let fixture: ComponentFixture<AtendimentoPassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ fixture, store, controller } = await montarPassoDeAtendimento());
    componente = fixture.componentInstance;
    elemento = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  describe.each([
    {
      secao: 'condições',
      lista: 'condicoes',
      prefixo: 'atend-cond-removida',
      titulo: 'atend-secao-condicoes',
    },
    {
      secao: 'recursos',
      lista: 'recursos',
      prefixo: 'atend-rec-removido',
      titulo: 'atend-secao-recursos',
    },
    {
      secao: 'tipos de deficiência',
      lista: 'tiposDeficiencia',
      prefixo: 'atend-tipo-removido',
      titulo: 'atend-secao-tipos',
    },
  ] as const)('retirar da oferta, na seção de $secao', ({ lista, prefixo, titulo }) => {
    const removidas = (nome: string) => [
      { id: `${nome}-a`, codigo: 'ANTIGO', nome: `${nome} A` },
      { id: `${nome}-b`, codigo: 'ANTIGO', nome: `${nome} B` },
    ];

    function comReferenciasRemovidasEmTodasAsSecoes(): void {
      store.patchObjectSection('atendimento', {
        condicoes: [
          { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' },
          ...removidas('condicoes'),
        ],
        recursos: removidas('recursos'),
        tiposDeficiencia: removidas('tiposDeficiencia'),
      });
      detectar();
    }

    it('retirado o último item da lista, o foco vai ao título da seção', async () => {
      store.patchObjectSection('atendimento', {
        condicoes: [
          { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' },
          ...removidas('condicoes').slice(0, 1),
        ],
        recursos: removidas('recursos').slice(0, 1),
        tiposDeficiencia: removidas('tiposDeficiencia').slice(0, 1),
      });
      detectar();

      elemento.querySelector<HTMLButtonElement>(`#${prefixo}-0`)?.click();
      detectar();
      await fixture.whenStable();
      detectar();

      expect(document.activeElement?.id).toBe(titulo);
    });

    it('o botão clicado tira só o item da própria seção e devolve o foco ao item anterior', async () => {
      comReferenciasRemovidasEmTodasAsSecoes();
      const antes = {
        condicoes: store.draft().atendimento.condicoes.length,
        recursos: store.draft().atendimento.recursos.length,
        tiposDeficiencia: store.draft().atendimento.tiposDeficiencia.length,
      };

      elemento.querySelector<HTMLButtonElement>(`#${prefixo}-1`)?.click();
      detectar();
      await fixture.whenStable();
      detectar();

      const depois = store.draft().atendimento;
      expect(depois[lista].map((item) => item.id)).not.toContain(`${lista}-b`);
      expect(depois[lista].map((item) => item.id)).toContain(`${lista}-a`);
      for (const outra of ['condicoes', 'recursos', 'tiposDeficiencia'] as const) {
        if (outra !== lista) expect(depois[outra]).toHaveLength(antes[outra]);
      }
      expect(document.activeElement?.id).toBe(`${prefixo}-0`);
    });

    it('o botão fica desabilitado enquanto uma gravação está em andamento', () => {
      comReferenciasRemovidasEmTodasAsSecoes();
      store.salvando.set(true);
      detectar();

      expect(elemento.querySelector<HTMLButtonElement>(`#${prefixo}-1`)?.disabled).toBe(true);
    });
  });

  it('mantém referência removida visível e permite removê-la', () => {
    // Simula hidratação de um recurso que já foi removido do cadastro.
    store.patchObjectSection('atendimento', {
      recursos: [{ id: 'id-antigo', nome: 'Recurso descontinuado' }],
    });
    detectar();

    expect(elemento.textContent).toContain('Recurso descontinuado');
    expect(elemento.textContent).toContain('Removido do cadastro');

    componente.retirarRecursoDaOferta('id-antigo');
    detectar();

    expect(store.draft().atendimento.recursos).toEqual([]);
    expect(componente.anuncio()).toBe('Removido da oferta: Recurso descontinuado.');
  });

  /**
   * Uma falha ao carregar qualquer catálogo de
   * Configuração substituía a tela inteira pelo erro, mesmo com o rascunho
   * já tendo os nomes de condição, recurso e tipo de deficiência (populados
   * por `hidratarDraft()` a partir de `dto.atendimentoEspecializado`) — o operador
   * não conseguia inspecionar a oferta persistida durante uma
   * indisponibilidade de catálogo, que é exatamente o cenário para o qual
   * os snapshots embutidos existem.
   *
   * "Removido do cadastro" também não pode aparecer aqui: sem catálogo
   * carregado, não há como confirmar se o item realmente saiu de lá —
   * "Catálogo indisponível" é o que a tela sabe de fato.
   */
  it('mostra as seleções já gravadas ao lado do erro de catálogo, sem tratá-las como removidas', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    expect(elemento.querySelector('button')?.textContent).toContain('Tentar novamente');
    expect(elemento.textContent).toContain('Pessoa com deficiência');
    expect(elemento.textContent).toContain('Ledor');
    expect(elemento.textContent).toContain('Deficiência visual');
    expect(elemento.textContent).toContain('Catálogo indisponível');
    expect(elemento.textContent).not.toContain('Removido do cadastro');
  });

  /**
   * Com o catálogo indisponível,
   * `condicoesRemovidas()`/`recursosRemovidos()`/`tiposDeficienciaRemovidos()`
   * comparam contra um catálogo ativo vazio — não porque nada está ativo,
   * mas porque a tela ainda não sabe. Classificar TODA seleção gravada como
   * removida mandaria o operador apagar uma oferta válida por causa de uma
   * indisponibilidade temporária, e seguir a instrução esvaziaria as três
   * listas e apagaria a oferta ao gravar.
   */
  it('não recusa nem propõe remoção de um rascunho hidratado quando o catálogo está indisponível', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    expect(componente.validar()).toEqual({ valid: true });
  });

  /** Mesmo caso acima, mas durante o carregamento inicial — antes de qualquer resposta chegar. */
  it('não recusa nem propõe remoção de um rascunho hidratado enquanto o catálogo ainda está carregando', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    componente.catalogos.carregando.set(true);
    detectar();

    expect(componente.validar()).toEqual({ valid: true });
  });

  /**
   * A interação completa: catálogo indisponível com
   * rascunho hidratado não bloqueia o avanço, não propõe remoção de nada, e
   * a gravação segue as listas como estão no rascunho — nunca vazias por
   * omissão da indisponibilidade do catálogo.
   */
  it('grava as listas do rascunho hidratado como estão, mesmo com o catálogo indisponível', async () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_ATENDIMENTO);
    expect(requisicao.request.body).toEqual({
      condicaoIds: ['id-condicao-gravada'],
      recursoIds: ['id-recurso-gravado'],
      tipoDeficienciaIds: ['id-tipo-gravado'],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * Nenhum controle que muta as três listas pode ficar habilitado enquanto a tela não sabe
   * distinguir "saiu do cadastro" de "não sei ainda": o item retirado sem querer não tem catálogo
   * que o restaure, e o próximo avanço gravaria a lista reduzida. As seleções gravadas seguem
   * visíveis carregando e em falha, para o estado de espera não virar beco sem saída.
   */
  it('desabilita todos os controles que mutam as três listas enquanto o catálogo carrega ou falha', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    function controles(): (HTMLInputElement | HTMLButtonElement)[] {
      return Array.from(
        elemento.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          'input[type="checkbox"], button[aria-label^="Remover definitivamente"]',
        ),
      );
    }

    function botoesDeRetirada(): HTMLButtonElement[] {
      return controles().filter(
        (controle): controle is HTMLButtonElement => controle instanceof HTMLButtonElement,
      );
    }

    // Ainda carregando: o rascunho gravado segue visível, mas nenhum controle o altera.
    componente.catalogos.carregando.set(true);
    detectar();
    expect(botoesDeRetirada()).toHaveLength(3);
    expect(controles().every((controle) => controle.disabled)).toBe(true);

    // Falha de carga: o rascunho gravado segue visível, mas nenhum controle o altera.
    componente.catalogos.carregando.set(false);
    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();
    expect(botoesDeRetirada()).toHaveLength(3);
    expect(controles().every((controle) => controle.disabled)).toBe(true);

    // Catálogo confirmado: os controles voltam a ficar disponíveis.
    componente.catalogos.erro.set(null);
    detectar();
    expect(botoesDeRetirada()).toHaveLength(3);
    expect(botoesDeRetirada().some((botao) => botao.disabled)).toBe(false);
    expect(controles().some((controle) => controle.disabled)).toBe(false);
  });

  /**
   * As seleções hidratadas renderizam
   * enquanto `carregando()` é `true` —
   * mas o catálogo ativo ainda está vazio nesse momento, então
   * `rotuloDeSituacaoRemovida()` não pode dizer "Removido do cadastro" (uma
   * afirmação que só o catálogo carregado sustenta). "Ainda não sei" não é
   * "não existe mais", nem no rótulo.
   */
  it('não rotula como "Removido do cadastro" uma seleção hidratada enquanto o catálogo ainda está carregando', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
    });
    detectar();

    componente.catalogos.carregando.set(true);
    detectar();

    expect(componente.rotuloDeSituacaoRemovida()).not.toBe('Removido do cadastro');
    expect(elemento.textContent).not.toContain('Removido do cadastro');
    expect(elemento.textContent).toContain('Pessoa com deficiência');
  });

  /**
   * A interação completa: catálogo em falha com rascunho hidratado não
   * bloqueia o avanço, não deixa nenhum controle disponível para alterar as
   * listas sem querer, e a gravação segue exatamente o que o rascunho já
   * tinha.
   */
  it('catálogo em falha com rascunho hidratado: controles desabilitados e avanço permitido sem alterar as listas', async () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    const checkboxes = Array.from(
      elemento.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>,
    );
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((input) => input.disabled)).toBe(true);

    expect(componente.validar()).toEqual({ valid: true });

    const gravacao = componente.persistir();
    const requisicao = controller.expectOne(ROTA_ATENDIMENTO);
    expect(requisicao.request.body).toEqual({
      condicaoIds: ['id-condicao-gravada'],
      recursoIds: ['id-recurso-gravado'],
      tipoDeficienciaIds: ['id-tipo-gravado'],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });
});
