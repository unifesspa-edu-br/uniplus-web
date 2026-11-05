import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { problemasDasOcorrencias } from '../modelo/grupos';
import { idsDescritivos } from '../ids-descritivos';
import { type GrupoDoFormulario } from '../modelo/tipos';

export type Contagem = 'minimo' | 'maximo';

export interface MudancaDeContagem {
  readonly contagem: Contagem;
  readonly valor: number | string | null;
}

/**
 * Quantas ocorrências o grupo tem — o mínimo e o máximo — e se o próprio candidato é um dos membros.
 * A inclusão do candidato é só pedida: quem edita o grupo a aceita ou recusa, e a caixa volta ao
 * estado real.
 */
@Component({
  selector: 'ui-ocorrencias-do-grupo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <fieldset class="editor-formulario__restricao" [attr.aria-describedby]="descricao()">
      <legend class="field__label">Ocorrências</legend>
      <div class="form-grid form-grid--pair">
        <div class="field">
          <label class="field__label" [for]="idDe('minimo')">Mínimo</label>
          <input
            class="input"
            type="text"
            inputmode="numeric"
            [id]="idDe('minimo')"
            [value]="grupo().minimo"
            [disabled]="disabled() || grupo().incluiCandidato"
            [attr.aria-invalid]="problemas().minimo ? 'true' : null"
            [attr.aria-describedby]="descricaoDoMinimo()"
            (change)="trocarContagem('minimo', $event)"
          />
        </div>
        <div class="field">
          <label class="field__label" [for]="idDe('maximo')">Máximo</label>
          <input
            class="input"
            type="text"
            inputmode="numeric"
            [id]="idDe('maximo')"
            [value]="grupo().maximo ?? ''"
            [disabled]="disabled()"
            [attr.aria-invalid]="problemas().maximo || problemas().relacao ? 'true' : null"
            [attr.aria-describedby]="descricaoDoMaximo()"
            (change)="trocarContagem('maximo', $event)"
          />
          <span class="field__hint" [id]="idDe('maximo-nota')"
            >Em branco: sem limite de ocorrências.</span
          >
        </div>
      </div>
      @if (problemas().minimo; as problema) {
        <p class="field__error" [id]="idDe('minimo-erro')">{{ problema }}</p>
      }
      @if (problemas().maximo; as problema) {
        <p class="field__error" [id]="idDe('maximo-erro')">{{ problema }}</p>
      }
      @if (problemas().relacao; as problema) {
        <p class="field__error" [id]="idDe('ocorrencias-erro')">{{ problema }}</p>
      }
      <label class="checkbox">
        <input
          type="checkbox"
          [checked]="grupo().incluiCandidato"
          [disabled]="disabled()"
          [attr.aria-describedby]="idDe('candidato-nota')"
          (change)="pedirCandidato($event)"
        />
        <span class="checkbox__box" aria-hidden="true"></span>
        O próprio candidato é um dos membros
      </label>
      <span class="field__hint" [id]="idDe('candidato-nota')">
        Como na composição familiar: o candidato responde a própria ocorrência, reconhecida pelo
        parentesco, e o grupo tem ao menos uma ocorrência.
      </span>
    </fieldset>
  `,
})
export class OcorrenciasDoGrupoComponent {
  readonly grupo = input.required<GrupoDoFormulario>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly contagemChange = output<MudancaDeContagem>();
  /** O estado que a pessoa pediu para a inclusão do candidato. */
  readonly candidatoPedido = output<boolean>();

  protected readonly problemas = computed(() => problemasDasOcorrencias(this.grupo()));

  protected readonly descricaoDoMinimo = computed(() =>
    idsDescritivos([
      this.grupo().incluiCandidato ? this.idDe('candidato-nota') : null,
      this.problemas().minimo === null ? null : this.idDe('minimo-erro'),
    ]),
  );

  protected readonly descricaoDoMaximo = computed(() =>
    idsDescritivos([
      this.idDe('maximo-nota'),
      this.problemas().maximo === null ? null : this.idDe('maximo-erro'),
      this.problemas().relacao === null ? null : this.idDe('ocorrencias-erro'),
    ]),
  );

  protected readonly descricao = computed(() =>
    idsDescritivos([
      this.problemas().minimo === null ? null : this.idDe('minimo-erro'),
      this.problemas().maximo === null ? null : this.idDe('maximo-erro'),
      this.problemas().relacao === null ? null : this.idDe('ocorrencias-erro'),
    ]),
  );

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  /** O número quando é inteiro; o texto como veio quando não é, para o problema dizer o quê. Máximo em branco é sem limite. */
  protected trocarContagem(contagem: Contagem, evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value.trim();
    if (texto === '') {
      this.contagemChange.emit({ contagem, valor: contagem === 'maximo' ? null : 0 });
      return;
    }
    const valor = Number.isFinite(Number(texto)) ? Number(texto) : texto;
    this.contagemChange.emit({ contagem, valor });
  }

  protected pedirCandidato(evento: Event): void {
    const caixa = evento.target as HTMLInputElement;
    const pedido = caixa.checked;
    // O navegador marca a caixa antes da decisão: ela volta ao estado real, que só muda se a edição for aceita.
    caixa.checked = this.grupo().incluiCandidato;
    this.candidatoPedido.emit(pedido);
  }
}
