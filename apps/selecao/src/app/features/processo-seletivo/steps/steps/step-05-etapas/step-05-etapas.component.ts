import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { EtapaEdital, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';

@Component({
  selector: 'sel-step-05-etapas',
  standalone: true,
  templateUrl: './step-05-etapas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(Step05EtapasComponent)],
})
export class Step05EtapasComponent {
  readonly store = inject(ProcessoSeletivoStore);
  /** Campos inválidos detectados na última validação (chave `tipo|inicio|fim-{id}`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());
  private nextId = 2;

  add(): void {
    const etapa: EtapaEdital = {
      id: `etapa-${this.nextId++}`,
      tipo: '',
      // Vazias de propósito: datas predefinidas passariam na validação sem o
      // operador confirmar, e envelhecem a cada ciclo.
      inicio: '',
      fim: '',
      nomeCustomizado: '',
      permiteRecurso: false,
      tagNumeroAtiva: false,
      administrativa: false,
    };
    this.store.patchSection('etapas', [...this.store.draft().etapas, etapa]);
  }

  update(id: string, patch: Partial<EtapaEdital>): void {
    this.store.patchSection(
      'etapas',
      this.store.draft().etapas.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  move(index: number, delta: number): void {
    const target = index + delta;
    const current = [...this.store.draft().etapas];
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    this.store.patchSection('etapas', current);
  }

  remove(id: string): void {
    this.store.patchSection(
      'etapas',
      this.store.draft().etapas.filter((item) => item.id !== id),
    );
  }

  openPicker(input: HTMLInputElement): void {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const etapas = this.store.draft().etapas;
    const messages: string[] = [];
    const invalid = new Set<string>();

    if (!etapas.length) {
      messages.push('Adicione ao menos uma etapa ao processo seletivo.');
    }

    etapas.forEach((etapa) => {
      if (!etapa.tipo) {
        messages.push(
          `Selecione o tipo da etapa "${etapa.nomeCustomizado || 'etapa'}" (${String(etapa.id)}).`,
        );
        invalid.add(`tipo-${etapa.id}`);
      }
      if (!etapa.inicio) {
        messages.push(
          `Informe o início da etapa "${etapa.nomeCustomizado || 'etapa'}" (${String(etapa.id)}).`,
        );
        invalid.add(`inicio-${etapa.id}`);
      }
      if (!etapa.fim) {
        messages.push(
          `Informe o fim da etapa "${etapa.nomeCustomizado || 'etapa'}" (${String(etapa.id)}).`,
        );
        invalid.add(`fim-${etapa.id}`);
      } else if (etapa.inicio && etapa.fim.localeCompare(etapa.inicio) < 0) {
        messages.push(
          `A data de fim da etapa "${etapa.nomeCustomizado || 'etapa'}" (${String(etapa.id)}) é anterior ao início.`,
        );
        invalid.add(`fim-${etapa.id}`);
      }
    });

    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }
}
