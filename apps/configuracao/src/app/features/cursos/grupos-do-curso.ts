import { Injectable, computed, inject, signal } from '@angular/core';
import { acompanharNovaTentativa, type FaseDaNovaTentativa } from '@uniplus/shared-ui/components';
import type { GrupoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { nullIfBlank } from '../../shared/formulario';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { motivoDaFalha } from '../../shared/lista-de-referencia';
import { comPontoFinal } from '../../shared/texto';

/** O que o formulário precisa saber do vocabulário de grupos de área do ENEM. */
export interface GruposDoFormulario {
  readonly falhou: boolean;
  readonly pendente: boolean;
  readonly fase: FaseDaNovaTentativa;
  readonly opcoes: readonly GrupoAreaEnemDto[];
  readonly mensagemDeFalha: string;
  readonly foraDasOpcoes: GrupoAreaEnemDto | null;
}

/**
 * Leitura dos grupos de área do ENEM que alimentam o select do formulário de curso: a falha, a
 * nova tentativa com foco e o grupo do curso em edição que a lista ainda não oferece.
 */
@Injectable()
export class GruposDoCurso {
  private readonly vocabulario = inject(CatalogoGruposAreaEnem);

  /**
   * O drawer do formulário está aberto: só então a falha da carga de fundo é avisada, e nunca a de
   * uma tentativa anterior enquanto a nova ainda está em curso.
   */
  readonly formularioAberto = signal(false);

  /** Grupo que o curso em edição já tem, como a tela o mostra. */
  private readonly grupoDoCursoEmEdicao = signal<GrupoAreaEnemDto | null>(null);

  private readonly motivoDaFalha = motivoDaFalha(
    this.vocabulario,
    () => this.formularioAberto() && !this.vocabulario.pendente(),
  );

  private readonly mensagemDeFalha = computed(() => {
    const semLista = 'Sem a lista de grupos não é possível classificar o curso.';
    const motivo = nullIfBlank(this.motivoDaFalha());
    return motivo ? `${comPontoFinal(motivo)} ${semLista}` : semLista;
  });

  /**
   * Grupo do curso em edição que a lista da API não oferece — a lista ainda não chegou ou falhou.
   * Sem uma option com esse código o select apareceria em branco, mas o controle continuaria com
   * o grupo do curso, e salvar reenviaria um grupo que o operador nunca viu selecionado. A opção
   * depende do grupo original do curso, e não do valor escolhido: trocar para "Não classificado"
   * não a tira, e dá para voltar a ele.
   */
  private readonly foraDasOpcoes = computed<GrupoAreaEnemDto | null>(() => {
    const doCurso = this.grupoDoCursoEmEdicao();
    if (doCurso === null || this.vocabulario.porCodigo().has(doCurso.codigo)) {
      return null;
    }
    // Sem código não há o que selecionar nem gravar: o "—" é só da tabela.
    return nullIfBlank(doCurso.codigo) === null ? null : doCurso;
  });

  readonly formulario = computed<GruposDoFormulario>(() => ({
    falhou: this.vocabulario.falhou(),
    pendente: this.vocabulario.pendente(),
    fase: this.novaTentativa.fase(),
    opcoes: this.vocabulario.opcoes(),
    mensagemDeFalha: this.mensagemDeFalha(),
    foraDasOpcoes: this.foraDasOpcoes(),
  }));

  /**
   * A lista chegou depois do "Tentar novamente": o alerta sai com o botão, e o foco vai ao select
   * que a lista alimenta, sem sair do formulário.
   */
  readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'grupos de área',
    pendente: this.vocabulario.pendente,
    falhou: this.vocabulario.falhou,
    destino: () => document.getElementById('cfg-curso-grupo-area-enem'),
  });

  /** Prepara a leitura para um formulário que abre: o grupo do curso (se houver) e a lista. */
  preparar(grupoDoCurso: GrupoAreaEnemDto | null | undefined): void {
    this.grupoDoCursoEmEdicao.set(grupoDoCurso ? this.vocabulario.exibivel(grupoDoCurso) : null);
    this.vocabulario.garantirCarregado();
  }

  tentarDeNovo(): void {
    this.novaTentativa.executar(() => this.vocabulario.tentarDeNovo());
  }
}
