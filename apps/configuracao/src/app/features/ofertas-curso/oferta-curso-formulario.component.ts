import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  FORMATOS_PEDAGOGICOS,
  PROGRAMAS_DE_OFERTA,
  REGIMES_DE_FUNCIONAMENTO,
  REGIMES_DE_TURNO,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraDoCampoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { OfertaCursoForm, mensagemDeErroDaOferta } from './oferta-curso-form';
import type { RegrasDoFormulario } from './regras-do-formulario-da-oferta';
import { alternarTurno } from './turnos-da-oferta';
import type { ChaveDoVinculo, VinculosDoFormulario } from './vinculos-da-oferta';

interface SelecaoDeVinculo {
  readonly chave: ChaveDoVinculo;
  readonly nome: 'cursoId' | 'localOfertaId' | 'unidadeOfertanteOrigemId';
  readonly rotulo: string;
  readonly id: string;
  readonly apoio: string | null;
}

/** Os três selects de vínculo, na ordem em que aparecem na criação. */
const SELECOES_DE_VINCULO: readonly SelecaoDeVinculo[] = [
  {
    chave: 'curso',
    nome: 'cursoId',
    rotulo: 'Curso',
    id: 'cfg-oferta-curso-id',
    apoio: null,
  },
  {
    chave: 'local',
    nome: 'localOfertaId',
    rotulo: 'Local de oferta',
    id: 'cfg-oferta-local-id',
    apoio: null,
  },
  {
    chave: 'unidade',
    nome: 'unidadeOfertanteOrigemId',
    rotulo: 'Unidade ofertante',
    id: 'cfg-oferta-unidade-id',
    apoio:
      'Congelada por snapshot-copy ao criar — alterações posteriores na unidade de origem não afetam a oferta (ADR-0061).',
  },
];

/** O drawer com o formulário de cadastro e edição de oferta de curso. */
@Component({
  selector: 'cfg-oferta-curso-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    SpinnerComponent,
    FalhaDeLeituraDoCampoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './oferta-curso-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class OfertaCursoFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<OfertaCursoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly vinculos = input.required<VinculosDoFormulario>();
  readonly regras = input.required<RegrasDoFormulario>();

  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  protected readonly selecoes = SELECOES_DE_VINCULO;
  protected readonly programas = PROGRAMAS_DE_OFERTA;
  protected readonly formatos = FORMATOS_PEDAGOGICOS;
  protected readonly regimesDeTurno = REGIMES_DE_TURNO;
  protected readonly regimesDeFuncionamento = REGIMES_DE_FUNCIONAMENTO;

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  /** Enquanto envia, o botão está indisponível: o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) {
      evento.preventDefault();
    }
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera o envio em curso. */
  protected aoEnviar(): void {
    if (this.salvando()) {
      return;
    }
    this.salvar.emit();
    if (this.form().invalid) {
      this.foco.focarPrimeiroInvalido();
    }
  }

  protected erroDoCampo(nome: keyof OfertaCursoForm): string | null {
    return mensagemDeErroDaOferta(this.form().controls[nome]);
  }

  protected idDoErro(nome: keyof OfertaCursoForm): string {
    return `cfg-oferta-${nome}-erro`;
  }

  /** Os ids que descrevem o campo: os textos de apoio fixos e, se houver, o erro. */
  protected descritoPor(nome: keyof OfertaCursoForm, ...apoios: string[]): string | null {
    const ids = this.erroDoCampo(nome) ? [...apoios, this.idDoErro(nome)] : apoios;
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected marcarTurno(token: string): void {
    alternarTurno(this.form().controls.turnos, token, this.regras().turnosExigidos);
  }
}
