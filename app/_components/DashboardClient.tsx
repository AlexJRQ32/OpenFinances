"use client";

import { useTransition, useState, useRef, useCallback, type FormEvent } from "react";
import {
  createFixedIncome,
  deleteFixedIncome,
  createFixedExpense,
  deleteFixedExpense,
  createVariableIncome,
  deleteVariableIncome,
  createVariableExpense,
  deleteVariableExpense,
  updateTransaction,
  updateCycleMode,
} from "@/app/actions";
import type { CycleMode } from "@/lib/cycle";
import { getCycleRange, getQuincenaRange } from "@/lib/cycle";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/categories";
import { useLiveCycleRefresh } from "./useLiveCycleRefresh";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  PlusIcon,
  TrashIcon,
  RepeatIcon,
  ZapIcon,
  WalletIcon,
  PencilIcon,
} from "./icons";
import Modal from "./Modal";
import { ToastProvider, useToast } from "./Toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface MovementItem {
  id: string;
  description: string;
  amount: string;
  category: string | null;
  dayOfMonth?: number | null;
  occurredOn?: string | null;
  originalAmount?: string | null;
  currency?: string | null;
}

interface QuincenaData {
  sobrante: string;
  fixedIncomes: MovementItem[];
  variableIncomes: MovementItem[];
  fixedExpenses: MovementItem[];
  variableExpenses: MovementItem[];
  fixedIncomesTotal: string;
  variableIncomesTotal: string;
  fixedExpensesTotal: string;
  variableExpensesTotal: string;
}

interface DashboardClientProps {
  userName: string | null;
  sobrante: string;
  cycleMode: CycleMode;
  fixedIncomes: MovementItem[];
  variableIncomes: MovementItem[];
  fixedExpenses: MovementItem[];
  variableExpenses: MovementItem[];
  fixedIncomesTotal: string;
  variableIncomesTotal: string;
  fixedExpensesTotal: string;
  variableExpensesTotal: string;
  usdRate: string | null;
  quincenal?: {
    q1: QuincenaData;
    q2: QuincenaData;
    currentIndex: 1 | 2;
  };
}

// ── Currency formatter ───────────────────────────────────────────────────────

const fmtCRC = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
});

function formatAmount(amount: string | number): string {
  return fmtCRC.format(Number(amount));
}

function formatUsd(amount: string | number): string {
  return "$" + Number(amount).toFixed(2);
}

// USD rows show their original dollar amount plus the canonical CRC stored amount (D8).
function formatMovement(
  item: Pick<MovementItem, "amount" | "originalAmount" | "currency">
): string {
  if (item.currency === "USD" && item.originalAmount) {
    return `${formatUsd(item.originalAmount)} · ${fmtCRC.format(Number(item.amount))}`;
  }
  return fmtCRC.format(Number(item.amount));
}

function formatAmountCompact(amount: string | number): string {
  const n = Number(amount);
  if (Math.abs(n) >= 1_000_000) {
    return fmtCRC.format(n / 1_000_000) + "M";
  }
  return formatAmount(amount);
}

// ── Today ISO for date input defaults ────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function quincenaStartDate(index: 1 | 2): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = index === 1 ? "01" : "16";
  return `${y}-${m}-${day}`;
}

function formatDateES(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function editTitle(base: string): string {
  return base.replace("Agregar", "Editar");
}

function editMessage(base: string): string {
  return base.replace("agregado", "actualizado");
}

function getDayChipLabel(dayOfMonth: number | null | undefined): string {
  if (dayOfMonth == null) return "Todas las quincenas";
  if (dayOfMonth <= 15) return `1ª quincena · día ${dayOfMonth}`;
  return `2ª quincena · día ${dayOfMonth}`;
}

function getDayChipClass(
  dayOfMonth: number | null | undefined,
  tint: "income" | "expense"
): string {
  if (dayOfMonth == null) return "bg-secondary/15 text-secondary";
  return tint === "income" ? "bg-income/15 text-income" : "bg-expense/15 text-expense";
}

// ── Main Component ───────────────────────────────────────────────────────────

// ── Confirm Modal ─────────────────────────────────────────────────────────────

interface ConfirmState {
  description: string;
  onConfirm: () => void;
}

function ConfirmModal({
  description,
  onConfirm,
  onCancel,
}: {
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={true}
      onClose={onCancel}
      title="Eliminar movimiento"
      role="alertdialog"
    >
      <p className="text-sm text-foreground">
        ¿Seguro que querés eliminar &quot;{description}&quot;? Esta acción no se
        puede deshacer.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="pressable flex h-[44px] flex-1 items-center justify-center rounded-lg text-sm font-medium text-muted transition-colors duration-[var(--duration-fast)] hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="pressable flex h-[44px] flex-1 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-sm font-medium text-destructive transition-colors duration-[var(--duration-fast)] hover:bg-destructive/20"
        >
          Eliminar
        </button>
      </div>
    </Modal>
  );
}

export default function DashboardClient(props: DashboardClientProps) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const requestDelete = useCallback(
    (description: string, onConfirm: () => void) => {
      setConfirmState({ description, onConfirm });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    confirmState?.onConfirm();
    setConfirmState(null);
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    setConfirmState(null);
  }, []);

  return (
    <ToastProvider>
      <DashboardInner {...props} requestDelete={requestDelete} />
      {confirmState && (
        <ConfirmModal
          description={confirmState.description}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ToastProvider>
  );
}

function DashboardInner({
  userName,
  sobrante,
  cycleMode,
  fixedIncomes,
  variableIncomes,
  fixedExpenses,
  variableExpenses,
  fixedIncomesTotal,
  variableIncomesTotal,
  fixedExpensesTotal,
  variableExpensesTotal,
  usdRate,
  quincenal,
  requestDelete,
}: DashboardClientProps & { requestDelete: (description: string, onConfirm: () => void) => void }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<CycleMode>(cycleMode);
  const [activeQuincena, setActiveQuincena] = useState<1 | 2>(
    quincenal?.currentIndex ?? 1
  );

  // Keep cycle data fresh when the PWA stays open across boundaries.
  useLiveCycleRefresh(mode);

  function handleModeChange(newMode: CycleMode) {
    setMode(newMode);
    const fd = new FormData();
    fd.set("cycleMode", newMode);
    startTransition(async () => {
      await updateCycleMode(fd);
    });
  }

  // Resolve displayed data: quincenal mode uses active quincena, mensual uses top-level
  const isQuincenalActive = mode === "quincenal" && quincenal != null;
  const qData = isQuincenalActive
    ? activeQuincena === 1
      ? quincenal.q1
      : quincenal.q2
    : null;

  // Client-computed badge label: instant on mode/quincena switch, no server round-trip.
  const now = new Date();
  const displayCycleLabel =
    mode === "quincenal"
      ? getQuincenaRange(now.getFullYear(), now.getMonth(), activeQuincena).label
      : getCycleRange("mensual", now).label;
  const displaySobrante = qData?.sobrante ?? sobrante;
  const displayFixedIncomes = qData?.fixedIncomes ?? fixedIncomes;
  const displayVariableIncomes = qData?.variableIncomes ?? variableIncomes;
  const displayFixedExpenses = qData?.fixedExpenses ?? fixedExpenses;
  const displayVariableExpenses = qData?.variableExpenses ?? variableExpenses;
  const displayFixedIncomesTotal = qData?.fixedIncomesTotal ?? fixedIncomesTotal;
  const displayVariableIncomesTotal = qData?.variableIncomesTotal ?? variableIncomesTotal;
  const displayFixedExpensesTotal = qData?.fixedExpensesTotal ?? fixedExpensesTotal;
  const displayVariableExpensesTotal = qData?.variableExpensesTotal ?? variableExpensesTotal;

  const sobranteNum = Number(displaySobrante);
  const totalIncomeCycle =
    Number(displayFixedIncomesTotal) + Number(displayVariableIncomesTotal);
  const totalExpenseCycle =
    Number(displayFixedExpensesTotal) + Number(displayVariableExpensesTotal);

  // Hero label adapts per mode
  const heroLabel = isQuincenalActive
    ? `Te sobra en la ${activeQuincena === 1 ? "1\u00AA" : "2\u00AA"} quincena`
    : "Te sobra este ciclo";

  // Default date for variable add form: today if viewing current quincena, else first day of range
  const variableDefaultDate =
    isQuincenalActive && activeQuincena !== quincenal.currentIndex
      ? quincenaStartDate(activeQuincena)
      : todayISO();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-7 px-4 pb-[calc(16px+var(--safe-bottom))] pt-[calc(12px+var(--safe-top))]">
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <header className="choreo sticky top-0 z-20 -mx-4 flex flex-col gap-3 border-b border-card-border bg-background/90 px-4 pb-3 pt-[var(--safe-top)] backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            Hola, {userName ?? "Usuario"}
          </h1>
          <span className="rounded-full border border-card-border bg-card/60 px-3 py-1 text-xs font-medium text-muted">
            {displayCycleLabel}
          </span>
        </div>
        <SegmentedControl
          options={[
            { value: "quincenal" as const, label: "Quincenal" },
            { value: "mensual" as const, label: "Mensual" },
          ]}
          value={mode}
          onChange={handleModeChange}
        />
        {isQuincenalActive && quincenal && (
          <QuincenaTabs
            active={activeQuincena}
            currentIndex={quincenal.currentIndex}
            onChange={setActiveQuincena}
          />
        )}
      </header>

      {/* ── Main content (dims while persisting mode change) ──────────── */}
      <div
        className={`transition-opacity duration-200 ${pending ? "opacity-60" : ""}`}
        aria-busy={pending}
      >
      {/* ── Hero Sobrante Card ────────────────────────────────────────── */}
      <section className="hero-aurora glass choreo-d1 p-5" aria-label="Resumen del ciclo">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {heroLabel}
        </p>
        <p
          className={`mt-1 text-5xl font-bold tracking-tight tabular ${
            sobranteNum >= 0 ? "text-income" : "text-expense"
          }`}
          aria-live="polite"
        >
          {formatAmount(displaySobrante)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="glass-sm flex items-center gap-2 p-3">
            <TrendingUpIcon className="h-4 w-4 shrink-0 text-income" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Ingresos
              </p>
              <p className="truncate text-sm font-semibold tabular text-income">
                {formatAmountCompact(totalIncomeCycle)}
              </p>
            </div>
          </div>
          <div className="glass-sm flex items-center gap-2 p-3">
            <TrendingDownIcon className="h-4 w-4 shrink-0 text-expense" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Gastos
              </p>
              <p className="truncate text-sm font-semibold tabular text-expense">
                {formatAmountCompact(totalExpenseCycle)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fijos ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="heading-fijos" className="choreo-d2">
        <h2
          id="heading-fijos"
          className="mb-3 mt-3 flex items-center gap-2 text-sm font-semibold text-muted"
        >
          <RepeatIcon className="h-4 w-4" />
          Fijos
        </h2>
        <div className="flex flex-col gap-4">
          <FixedSectionCard
            title="Ingresos fijos"
            total={displayFixedIncomesTotal}
            totalColor="income"
            items={displayFixedIncomes}
            pending={pending}
            icon={<TrendingUpIcon className="h-4 w-4 text-income" />}
            dayLabel="día"
            createAction={createFixedIncome}
            deleteAction={deleteFixedIncome}
            startTransition={startTransition}
            formType="fixed"
            kind="income"
            usdRate={usdRate}
            modalTitle="Agregar ingreso fijo"
            successMessage="Ingreso fijo agregado"
            requestDelete={requestDelete}
          />
          <FixedSectionCard
            title="Gastos fijos"
            total={displayFixedExpensesTotal}
            totalColor="expense"
            items={displayFixedExpenses}
            pending={pending}
            icon={<TrendingDownIcon className="h-4 w-4 text-expense" />}
            dayLabel="vence día"
            createAction={createFixedExpense}
            deleteAction={deleteFixedExpense}
            startTransition={startTransition}
            formType="fixed"
            kind="expense"
            usdRate={usdRate}
            modalTitle="Agregar gasto fijo"
            successMessage="Gasto fijo agregado"
            requestDelete={requestDelete}
          />
        </div>
      </section>

      {/* ── Variables ─────────────────────────────────────────────────── */}
      <section aria-labelledby="heading-variables" className="choreo-d3">
        <h2
          id="heading-variables"
          className="mb-3 mt-3 flex items-center gap-2 text-sm font-semibold text-muted"
        >
          <ZapIcon className="h-4 w-4" />
          Variables
        </h2>
        <VariableTabs
          variableIncomes={displayVariableIncomes}
          variableExpenses={displayVariableExpenses}
          variableIncomesTotal={displayVariableIncomesTotal}
          variableExpensesTotal={displayVariableExpensesTotal}
          pending={pending}
          startTransition={startTransition}
          defaultDate={variableDefaultDate}
          usdRate={usdRate}
          requestDelete={requestDelete}
        />
      </section>
      </div>
    </div>
  );
}

// ── Segmented Control ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; current?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-card-border bg-black/40 p-[3px]"
      role="radiogroup"
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`pressable min-h-[40px] rounded-full px-4 text-sm transition-colors duration-[var(--duration-fast)] ${
              isSelected
                ? "bg-foreground/15 font-medium text-foreground shadow-sm"
                : "font-medium text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
            {opt.current && (
              <span
                className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  isSelected ? "bg-foreground" : "bg-accent"
                }`}
                aria-label="actual"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Quincena Underline Tabs ──────────────────────────────────────────────────

function QuincenaTabs({
  active,
  currentIndex,
  onChange,
}: {
  active: 1 | 2;
  currentIndex: 1 | 2;
  onChange: (v: 1 | 2) => void;
}) {
  const tabs: { value: 1 | 2; label: string }[] = [
    { value: 1, label: "1\u00AA quincena" },
    { value: 2, label: "2\u00AA quincena" },
  ];

  return (
    <div className="flex items-center gap-6" role="tablist">
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        const isCurrent = currentIndex === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`pressable relative min-h-[40px] px-1 pb-2 text-sm transition-colors duration-[var(--duration-fast)] ${
              isActive
                ? "text-foreground font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {isCurrent && (
              <span
                className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  isActive ? "bg-foreground" : "bg-accent"
                }`}
                aria-label="actual"
              />
            )}
            <span
              className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent transition-opacity duration-150 ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Fixed Section Card ───────────────────────────────────────────────────────

function FixedSectionCard({
  title,
  total,
  totalColor,
  items,
  pending,
  icon,
  dayLabel,
  createAction,
  deleteAction,
  startTransition,
  formType,
  kind,
  modalTitle,
  successMessage,
  usdRate,
  requestDelete,
}: {
  title: string;
  total: string;
  totalColor: "income" | "expense";
  items: MovementItem[];
  pending: boolean;
  icon: React.ReactNode;
  dayLabel: string;
  createAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
  startTransition: (fn: () => Promise<void>) => void;
  formType: "fixed" | "variable";
  kind: "income" | "expense";
  modalTitle: string;
  successMessage: string;
  usdRate: string | null;
  requestDelete: (description: string, onConfirm: () => void) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MovementItem | null>(null);
  const colorClass = totalColor === "income" ? "text-income" : "text-expense";
  const { toast } = useToast();

  const typeKey = kind === "income" ? "fixed-income" : "fixed-expense";

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function requestEdit(item: MovementItem) {
    setEditing(item);
    setModalOpen(true);
  }

  return (
    <div className="glass p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className={`text-sm font-semibold tabular ${colorClass}`}>
          {formatAmount(total)}
        </span>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-subtle">
          Sin fijos en esta quincena
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-card-border bg-card/30 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.description}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {item.category && (
                    <span className="rounded-md bg-card/60 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {item.category}
                    </span>
                  )}
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getDayChipClass(item.dayOfMonth, totalColor)}`}>
                    {getDayChipLabel(item.dayOfMonth)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-medium tabular ${colorClass} text-left`}>
                  {formatMovement(item)}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => requestEdit(item)}
                  className="pressable flex h-[44px] w-[44px] items-center justify-center rounded-lg text-muted-subtle transition-colors duration-[var(--duration-fast)] hover:bg-foreground/10 hover:text-foreground active:bg-foreground/15 active:text-foreground disabled:opacity-40"
                  aria-label={`Editar ${item.description}`}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    requestDelete(item.description, () => {
                      const fd = new FormData();
                      fd.set("id", item.id);
                      startTransition(async () => {
                        try {
                          await deleteAction(fd);
                          toast({
                            message: `${item.description} eliminado`,
                            variant: "success",
                          });
                        } catch {
                          toast({
                            message: "No se pudo eliminar",
                            variant: "destructive",
                          });
                        }
                      });
                    });
                  }}
                  className="pressable flex h-[44px] w-[44px] items-center justify-center rounded-lg text-muted-subtle transition-colors duration-[var(--duration-fast)] hover:bg-expense/10 hover:text-expense active:bg-expense/20 active:text-expense disabled:opacity-40"
                  aria-label={`Eliminar ${item.description}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add trigger */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="pressable mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-foreground/10 text-sm font-medium text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-foreground/15"
      >
        <PlusIcon className="h-4 w-4" />
        Agregar
      </button>

      {/* Modal with form */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? editTitle(modalTitle) : modalTitle}
      >
        <AddForm
          type={formType}
          kind={kind}
          typeKey={typeKey}
          item={editing}
          action={editing ? updateTransaction : createAction}
          onSuccess={() => {
            toast({
              message: editing ? editMessage(successMessage) : successMessage,
              variant: "success",
            });
            closeModal();
          }}
          startTransition={startTransition}
          usdRate={usdRate}
        />
      </Modal>
    </div>
  );
}

// ── Variable Tabs ────────────────────────────────────────────────────────────

function VariableTabs({
  variableIncomes,
  variableExpenses,
  variableIncomesTotal,
  variableExpensesTotal,
  pending,
  startTransition,
  defaultDate,
  usdRate,
  requestDelete,
}: {
  variableIncomes: MovementItem[];
  variableExpenses: MovementItem[];
  variableIncomesTotal: string;
  variableExpensesTotal: string;
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  defaultDate?: string;
  usdRate: string | null;
  requestDelete: (description: string, onConfirm: () => void) => void;
}) {
  const [activeTab, setActiveTab] = useState<"incomes" | "expenses">("incomes");

  return (
    <div className="glass p-4">
      {/* Tab bar */}
      <div
        className="choreo choreo-d1 mb-4 inline-flex rounded-xl border border-card-border bg-card/50 p-1"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "incomes"}
          onClick={() => setActiveTab("incomes")}
          className={`pressable min-h-[44px] rounded-lg px-5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
            activeTab === "incomes"
              ? "bg-income/15 text-income"
              : "text-muted hover:text-foreground"
          }`}
        >
          Ingresos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "expenses"}
          onClick={() => setActiveTab("expenses")}
          className={`pressable min-h-[44px] rounded-lg px-5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
            activeTab === "expenses"
              ? "bg-expense/15 text-expense"
              : "text-muted hover:text-foreground"
          }`}
        >
          Gastos
        </button>
      </div>

      {/* Tab panels */}
      {activeTab === "incomes" ? (
        <div className="tab-fade-in">
        <VariablePanel
          items={variableIncomes}
          total={variableIncomesTotal}
          totalColor="income"
          pending={pending}
          createAction={createVariableIncome}
          deleteAction={deleteVariableIncome}
          startTransition={startTransition}
          kind="income"
          emptyMessage="Sin ingresos variables este ciclo"
          usdRate={usdRate}
          modalTitle="Agregar ingreso variable"
          successMessage="Ingreso variable agregado"
          defaultDate={defaultDate}
          requestDelete={requestDelete}
        />
        </div>
      ) : (
        <div className="tab-fade-in">
        <VariablePanel
          items={variableExpenses}
          total={variableExpensesTotal}
          totalColor="expense"
          pending={pending}
          createAction={createVariableExpense}
          deleteAction={deleteVariableExpense}
          startTransition={startTransition}
          kind="expense"
          emptyMessage="Sin gastos variables este ciclo"
          usdRate={usdRate}
          modalTitle="Agregar gasto variable"
          successMessage="Gasto variable agregado"
          defaultDate={defaultDate}
          requestDelete={requestDelete}
        />
        </div>
      )}
    </div>
  );
}

function VariablePanel({
  items,
  total,
  totalColor,
  pending,
  createAction,
  deleteAction,
  startTransition,
  kind,
  emptyMessage,
  modalTitle,
  successMessage,
  defaultDate,
  usdRate,
  requestDelete,
}: {
  items: MovementItem[];
  total: string;
  totalColor: "income" | "expense";
  pending: boolean;
  createAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
  startTransition: (fn: () => Promise<void>) => void;
  kind: "income" | "expense";
  emptyMessage: string;
  modalTitle: string;
  successMessage: string;
  defaultDate?: string;
  usdRate: string | null;
  requestDelete: (description: string, onConfirm: () => void) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MovementItem | null>(null);
  const colorClass = totalColor === "income" ? "text-income" : "text-expense";
  const { toast } = useToast();

  const typeKey = kind === "income" ? "variable-income" : "variable-expense";

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function requestEdit(item: MovementItem) {
    setEditing(item);
    setModalOpen(true);
  }

  return (
    <div role="tabpanel">
      {/* Total */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Total
        </span>
        <span className={`text-sm font-semibold tabular ${colorClass}`}>
          {formatAmount(total)}
        </span>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-6 text-muted-subtle">
          <div className="empty-ring">
            <WalletIcon className="h-5 w-5" />
          </div>
          <p className="text-xs">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-card-border bg-card/30 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.description}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {item.category && (
                    <span className="rounded-md bg-card/60 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {item.category}
                    </span>
                  )}
                  {item.occurredOn && (
                    <span className="text-[10px] text-muted-subtle">
                      {formatDateES(item.occurredOn)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-medium tabular ${colorClass} text-left`}>
                  {formatMovement(item)}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => requestEdit(item)}
                  className="pressable flex h-[44px] w-[44px] items-center justify-center rounded-lg text-muted-subtle transition-colors duration-[var(--duration-fast)] hover:bg-foreground/10 hover:text-foreground active:bg-foreground/15 active:text-foreground disabled:opacity-40"
                  aria-label={`Editar ${item.description}`}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    requestDelete(item.description, () => {
                      const fd = new FormData();
                      fd.set("id", item.id);
                      startTransition(async () => {
                        try {
                          await deleteAction(fd);
                          toast({
                            message: `${item.description} eliminado`,
                            variant: "success",
                          });
                        } catch {
                          toast({
                            message: "No se pudo eliminar",
                            variant: "destructive",
                          });
                        }
                      });
                    });
                  }}
                  className="pressable flex h-[44px] w-[44px] items-center justify-center rounded-lg text-muted-subtle transition-colors duration-[var(--duration-fast)] hover:bg-expense/10 hover:text-expense active:bg-expense/20 active:text-expense disabled:opacity-40"
                  aria-label={`Eliminar ${item.description}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add trigger */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="pressable mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-foreground/10 text-sm font-medium text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-foreground/15"
      >
        <PlusIcon className="h-4 w-4" />
        Agregar
      </button>

      {/* Modal with form */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? editTitle(modalTitle) : modalTitle}
      >
        <AddForm
          type="variable"
          kind={kind}
          typeKey={typeKey}
          item={editing}
          action={editing ? updateTransaction : createAction}
          onSuccess={() => {
            toast({
              message: editing ? editMessage(successMessage) : successMessage,
              variant: "success",
            });
            closeModal();
          }}
          startTransition={startTransition}
          defaultDate={defaultDate}
          usdRate={usdRate}
        />
      </Modal>
    </div>
  );
}

// ── Add/Edit Form (inside modal) ─────────────────────────────────────────────

function AddForm({
  type,
  kind,
  typeKey,
  item,
  action,
  onSuccess,
  startTransition,
  defaultDate,
  usdRate,
}: {
  type: "fixed" | "variable";
  kind: "income" | "expense";
  typeKey: "fixed-income" | "fixed-expense" | "variable-income" | "variable-expense";
  item: MovementItem | null;
  action: (fd: FormData) => Promise<void>;
  onSuccess: () => void;
  startTransition: (fn: () => Promise<void>) => void;
  defaultDate?: string;
  usdRate: string | null;
}) {
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isEdit = item != null;

  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Editing a USD row: the editable figure is the original USD amount (D8),
  // the stored CRC amount is a derived display value, not an input.
  const initialCurrency = item?.currency === "USD" ? "USD" : "CRC";
  const [currency, setCurrency] = useState<"USD" | "CRC">(initialCurrency);
  const initialAmount =
    item?.currency === "USD" && item?.originalAmount ? item.originalAmount : (item?.amount ?? "");

  return (
    <form
      ref={formRef}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        try {
          await action(fd);
          onSuccess();
          // Reset form after success (in case modal stays open briefly)
          formRef.current?.reset();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "No se pudo guardar"
          );
        }
      }}
      className="flex flex-col gap-2.5"
    >
      {isEdit && (
        <>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="type" value={typeKey} />
        </>
      )}
      <input
        name="description"
        placeholder="Descripción"
        required
        maxLength={120}
        defaultValue={item?.description ?? ""}
        className="h-[44px] w-full rounded-lg border border-card-border bg-background px-3 text-sm text-foreground placeholder:text-muted-subtle focus:border-secondary focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder={currency === "USD" ? "Monto (USD)" : "Monto"}
            required
            inputMode="decimal"
            defaultValue={initialAmount}
            aria-label={currency === "USD" ? "Monto en dólares" : "Monto en colones"}
            className="h-[44px] w-full rounded-lg border border-card-border bg-background pl-3 pr-10 text-sm tabular text-foreground placeholder:text-muted-subtle focus:border-secondary focus:outline-none"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-subtle"
          >
            {currency === "USD" ? "$" : "₡"}
          </span>
        </div>
        <div className="relative">
          <select
            name="currency"
            aria-label="Moneda"
            value={currency}
            onChange={(e) => setCurrency(e.target.value === "USD" ? "USD" : "CRC")}
            className="h-[44px] w-full appearance-none rounded-lg border border-card-border bg-background px-3 pr-8 text-sm text-foreground focus:border-secondary focus:outline-none"
          >
            <option value="CRC">CRC ₡</option>
            <option value="USD">USD $</option>
          </select>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {currency === "USD" && (
        <p className="text-xs text-muted">
          {usdRate
            ? `Se convierte a colones al crear: ₡${usdRate} por USD, tasa venta BCCR`
            : "Cuando se elija el monto en USD, se usará la tasa venta de BCCR"}
        </p>
      )}
      <div className="relative">
        <select
          name="category"
          aria-label="Categoría"
          defaultValue={item?.category ?? ""}
          className="h-[44px] w-full appearance-none rounded-lg border border-card-border bg-background px-3 pr-8 text-sm text-foreground focus:border-secondary focus:outline-none"
        >
          <option value="">Sin categoría</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      {type === "fixed" ? (
        <div className="flex flex-col gap-1">
          <input
            id="dayOfMonth-input"
            name="dayOfMonth"
            type="number"
            min={1}
            max={31}
            placeholder="Día del mes (1–31)"
            inputMode="numeric"
            defaultValue={item?.dayOfMonth ?? ""}
            aria-describedby="dayOfMonth-hint"
            className="h-[44px] w-full rounded-lg border border-card-border bg-background px-3 text-sm tabular text-foreground placeholder:text-muted-subtle focus:border-secondary focus:outline-none"
          />
          <p id="dayOfMonth-hint" className="text-xs text-muted-subtle">
            Con día 1–15 se aplica en la 1ª quincena; 16–31 en la 2ª; vacío en todas.
          </p>
        </div>
      ) : (
        <input
          name="occurredOn"
          type="date"
          defaultValue={item?.occurredOn ?? defaultDate ?? todayISO()}
          required
          className="h-[44px] w-full rounded-lg border border-card-border bg-background px-3 text-sm text-foreground focus:border-secondary focus:outline-none"
        />
      )}
      {error && (
        <p className="rounded-lg border border-expense/20 bg-expense/10 px-3 py-2 text-xs text-expense">
          {error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="pressable flex h-[44px] flex-1 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-foreground transition-opacity duration-[var(--duration-fast)] hover:opacity-90"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
