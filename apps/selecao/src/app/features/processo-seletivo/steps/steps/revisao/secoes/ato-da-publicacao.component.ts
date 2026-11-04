import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import { itensDoAto, rotuloDoTipoDeAto } from '../itens-do-ato';
import { janelaDaInscricao, temFaseDeColetaInscricao } from '../periodo-de-inscricao';
import { ProntidaoDaPublicacao } from '../prontidao-da-publicacao.service';
import { ConferenciaDaPublicacao } from '../servicos/conferencia-da-publicacao.service';
import { PublicacaoDoProcesso } from '../servicos/publicacao-do-processo.service';

/**
 * O documento e o ato da publicação: o formulário do ato e do período de inscrição, ou, quando o
 * processo já não aceita edição, o ato lido como texto. O rascunho é a fonte de verdade do
 * formulário: um `effect` o empurra para os controles sem realimentar o próprio evento, e o único
 * caminho de volta é `valueChanges`. O formulário habilita e desabilita os próprios controles, e
 * nunca `[disabled]` no template, que perde a corrida contra o `FormGroup`.
 */
@Component({
  selector: 'sel-ato-da-publicacao',
  imports: [ReactiveFormsModule, ValorEmConsultaComponent],
  templateUrl: './ato-da-publicacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'step-section',
    role: 'region',
    'aria-labelledby': 'revisao-documento-titulo',
  },
})
export class AtoDaPublicacaoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly prontidao = inject(ProntidaoDaPublicacao);
  protected readonly conferencia = inject(ConferenciaDaPublicacao);
  protected readonly publicacao = inject(PublicacaoDoProcesso);
  private readonly catalogosDoCronograma = inject(CatalogosDoCronograma);
  private readonly dataBr = new DateBrPipe();

  protected readonly form = new FormGroup({
    numero: new FormControl<string>('', { nonNullable: true }),
    tipoAtoCodigo: new FormControl<string>('', { nonNullable: true }),
    orgao: new FormControl<string>('', { nonNullable: true }),
    serie: new FormControl<string>('', { nonNullable: true }),
    ano: new FormControl<string>('', { nonNullable: true }),
    dataPublicacao: new FormControl<string>('', { nonNullable: true }),
    assinante: new FormControl<string>('', { nonNullable: true }),
    periodoInscricaoInicio: new FormControl<string>('', { nonNullable: true }),
    periodoInscricaoFim: new FormControl<string>('', { nonNullable: true }),
  });

  private readonly valoresDoRascunho = computed(() => {
    const { numero, ato, periodoInscricaoInicio, periodoInscricaoFim } =
      this.store.draft().publicacao;
    return { numero, ...ato, periodoInscricaoInicio, periodoInscricaoFim };
  });

  protected readonly temFaseDeColeta = computed(() =>
    temFaseDeColetaInscricao(this.store.draft(), this.catalogosDoCronograma.fasePorId()),
  );

  protected readonly janelaDaInscricao = computed(() =>
    janelaDaInscricao(this.store.draft(), this.catalogosDoCronograma.fasePorId()),
  );

  /** O período de inscrição transcrito, quando o cronograma não tem fase que o derive. */
  protected readonly periodoDeInscricaoLido = computed(() => {
    const { periodoInscricaoInicio, periodoInscricaoFim } = this.store.draft().publicacao;
    return periodoInscricaoInicio && periodoInscricaoFim
      ? `${periodoInscricaoInicio} até ${periodoInscricaoFim}`
      : '';
  });

  /**
   * A transcrição do ato gravada no rascunho, para o processo que não aceita edição e ainda não
   * tem ato publicado a mostrar (cancelado, encerrado).
   */
  protected readonly atoDoRascunhoLido = computed(() => {
    const { numero, ato } = this.store.draft().publicacao;
    return itensDoAto({
      ...ato,
      numero: numero.trim() || 'Não informado',
      tipo: rotuloDoTipoDeAto(this.prontidao.tiposAto(), ato.tipoAtoCodigo),
      dataPublicacao: ato.dataPublicacao ? this.dataBr.transform(ato.dataPublicacao) : '',
    });
  });

  /** O ato vigente do processo já publicado, na ordem do formulário que ele substitui. */
  protected readonly resumoDoAto = computed(() => {
    const leitura = this.publicacao.atoPublicado();
    if (leitura?.estado !== 'lido') return [];

    const { ato } = leitura;
    const tipo = this.prontidao.tiposAto().find((item) => item.codigo === ato.tipoCodigo);
    return itensDoAto({
      ...ato,
      numero: ato.numero?.trim() || 'não informado',
      tipo: tipo?.nome ?? ato.tipoCodigo,
      ano: String(ato.ano),
      dataPublicacao: this.dataBr.transform(ato.dataPublicacao),
    });
  });

  constructor() {
    this.empurrarRascunhoParaOFormulario();
    this.habilitarFormularioConformeAEdicao();
    this.limparTipoDeAtoForaDoCatalogo();
    this.gravarFormularioNoRascunho();
  }

  protected tentarLerAtoDeNovo(): void {
    const id = this.store.processoSeletivoId();
    if (id !== null) void this.publicacao.lerAtoPublicado(id);
  }

  /**
   * Um "Atualizar checklist" pode trazer um catálogo sem o tipo escolhido antes, que deixou de ser
   * vigente entre as duas leituras. O `<select>` recua para o placeholder, e sem a limpeza o
   * rascunho guardaria o código velho, aprovado por `validate()` e recusado só depois da
   * confirmação. Só limpa com o catálogo definitivamente carregado, nunca durante a primeira carga.
   */
  private limparTipoDeAtoForaDoCatalogo(): void {
    effect(() => {
      const carregando = this.prontidao.carregando();
      const erro = this.prontidao.erro();
      const tipos = this.prontidao.tiposAto();
      if (carregando || erro !== null) return;

      untracked(() => {
        const { ato } = this.store.draft().publicacao;
        if (ato.tipoAtoCodigo !== '' && !tipos.some((tipo) => tipo.codigo === ato.tipoAtoCodigo)) {
          this.store.patchObjectSection('publicacao', { ato: { ...ato, tipoAtoCodigo: '' } });
        }
      });
    });
  }

  private empurrarRascunhoParaOFormulario(): void {
    effect(() => {
      const valores = this.valoresDoRascunho();
      untracked(() => {
        for (const chave of Object.keys(valores) as (keyof typeof valores)[]) {
          const controle = this.form.controls[chave];
          if (controle.value !== valores[chave])
            controle.setValue(valores[chave], { emitEvent: false });
        }
      });
    });
  }

  private habilitarFormularioConformeAEdicao(): void {
    effect(() => {
      const habilitado = this.store.aceitaEdicao();
      untracked(() => {
        if (habilitado && this.form.disabled) this.form.enable({ emitEvent: false });
        if (!habilitado && this.form.enabled) this.form.disable({ emitEvent: false });
      });
    });
  }

  private gravarFormularioNoRascunho(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((valores) => {
      this.store.patchObjectSection('publicacao', {
        numero: valores.numero ?? '',
        periodoInscricaoInicio: valores.periodoInscricaoInicio ?? '',
        periodoInscricaoFim: valores.periodoInscricaoFim ?? '',
        ato: {
          orgao: valores.orgao ?? '',
          serie: valores.serie ?? '',
          ano: valores.ano ?? '',
          dataPublicacao: valores.dataPublicacao ?? '',
          assinante: valores.assinante ?? '',
          tipoAtoCodigo: valores.tipoAtoCodigo ?? '',
        },
      });
    });
  }
}
