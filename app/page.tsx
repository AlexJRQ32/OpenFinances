import { auth, isGoogleConfigured, DbNotConfiguredError } from "@/auth";
import { computeSummary } from "@/lib/data";
import { shiftToOffset } from "@/lib/cycle";
import { cookies } from "next/headers";
import DashboardClient from "@/app/_components/DashboardClient";
import AuthClient from "@/app/_components/AuthClient";
import { fetchRate } from "@/lib/exchange";
import { DatabaseIcon } from "@/app/_components/icons";

export default async function Home() {
  const session = await auth();

  // No session → sign-in screen
  if (!session?.user) {
    return <AuthClient googleReady={isGoogleConfigured} />;
  }

  // Authenticated → dashboard
  return <Dashboard />;
}

// ── Dashboard (server component) ─────────────────────────────────────────────

async function Dashboard() {
  let content: React.ReactNode;

  try {
    // Dynamic import to avoid loading getCurrentUser at module level for sign-in page
    const { getCurrentUser } = await import("@/auth");
    const user = await getCurrentUser();

    // Read client timezone offset from cookie (set by useLiveCycleRefresh).
    // Fallback to 0 (UTC) on first visit — client will set cookie and re-render.
    const cookieStore = await cookies();
    const tz = Number(cookieStore.get("localTzOffsetMinutes")?.value ?? "0");
    const localNow = shiftToOffset(new Date(), tz);

    if (user.cycleMode === "quincenal") {
      // Compute both quincenas for the current month (using local wall time)
      const year = localNow.getUTCFullYear();
      const month = localNow.getUTCMonth();
      const currentIndex: 1 | 2 = localNow.getUTCDate() <= 15 ? 1 : 2;

      const [q1Summary, q2Summary, usdRate] = await Promise.all([
        computeSummary(
          user.id,
          "quincenal",
          new Date(Date.UTC(year, month, 1))
        ),
        computeSummary(
          user.id,
          "quincenal",
          new Date(Date.UTC(year, month, 16))
        ),
        safeUsdRate(),
      ]);

      const currentSummary = currentIndex === 1 ? q1Summary : q2Summary;

      content = (
        <DashboardClient
          userName={user.name}
          sobrante={currentSummary.sobrante}
          cycleMode={user.cycleMode}
          fixedIncomes={currentSummary.fixedIncomes.map(toMovementItem)}
          variableIncomes={currentSummary.variableIncomes.map(toMovementItem)}
          fixedExpenses={currentSummary.fixedExpenses.map(toMovementItem)}
          variableExpenses={currentSummary.variableExpenses.map(toMovementItem)}
          fixedIncomesTotal={currentSummary.fixedIncomesTotal}
          variableIncomesTotal={currentSummary.variableIncomesTotal}
          fixedExpensesTotal={currentSummary.fixedExpensesTotal}
          variableExpensesTotal={currentSummary.variableExpensesTotal}
          quincenal={{
            q1: toQuincenaData(q1Summary),
            q2: toQuincenaData(q2Summary),
            currentIndex,
          }}
          usdRate={usdRate}
        />
      );
    } else {
      const [summary, usdRate] = await Promise.all([
        computeSummary(user.id, user.cycleMode, localNow),
        safeUsdRate(),
      ]);

      content = (
        <DashboardClient
          userName={user.name}
          sobrante={summary.sobrante}
          cycleMode={user.cycleMode}
          fixedIncomes={summary.fixedIncomes.map(toMovementItem)}
          variableIncomes={summary.variableIncomes.map(toMovementItem)}
          fixedExpenses={summary.fixedExpenses.map(toMovementItem)}
          variableExpenses={summary.variableExpenses.map(toMovementItem)}
          fixedIncomesTotal={summary.fixedIncomesTotal}
          variableIncomesTotal={summary.variableIncomesTotal}
          fixedExpensesTotal={summary.fixedExpensesTotal}
          variableExpensesTotal={summary.variableExpensesTotal}
          usdRate={usdRate}
        />
      );
    }
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      content = (
        <div className="choreo-auth mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-card-border bg-card/60">
            <DatabaseIcon className="h-8 w-8 text-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Base de datos no configurada
            </p>
            <p className="mt-1 text-xs text-muted">
              Seteá{" "}
              <code className="rounded bg-card/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-secondary">
                DATABASE_URL
              </code>{" "}
              para comenzar.
            </p>
          </div>
        </div>
      );
    } else {
      throw err;
    }
  }

  return <main className="flex-1">{content}</main>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Current USD→CRC rate for the form hint. Never blocks the dashboard:
 * if the rate source is down the hint is hidden and USD entries are rejected
 * server-side with a clear message (D5).
 */
async function safeUsdRate(): Promise<string | null> {
  try {
    return (await fetchRate()).toFixed(2);
  } catch {
    return null;
  }
}

function toMovementItem(item: {
  id: string;
  description: string;
  amount: string;
  category: string | null;
  dayOfMonth?: number | null;
  occurredOn?: string | null;
  originalAmount?: string | null;
  currency?: string | null;
}) {
  return {
    id: item.id,
    description: item.description,
    amount: item.amount,
    category: item.category,
    dayOfMonth: item.dayOfMonth ?? null,
    occurredOn: item.occurredOn ?? null,
    originalAmount: item.originalAmount ?? null,
    currency: item.currency ?? null,
  };
}

function toQuincenaData(summary: {
  sobrante: string;
  fixedIncomes: { id: string; description: string; amount: string; category: string | null; dayOfMonth?: number | null; occurredOn?: string | null }[];
  variableIncomes: { id: string; description: string; amount: string; category: string | null; dayOfMonth?: number | null; occurredOn?: string | null }[];
  fixedExpenses: { id: string; description: string; amount: string; category: string | null; dayOfMonth?: number | null; occurredOn?: string | null }[];
  variableExpenses: { id: string; description: string; amount: string; category: string | null; dayOfMonth?: number | null; occurredOn?: string | null }[];
  fixedIncomesTotal: string;
  variableIncomesTotal: string;
  fixedExpensesTotal: string;
  variableExpensesTotal: string;
}) {
  return {
    sobrante: summary.sobrante,
    fixedIncomes: summary.fixedIncomes.map(toMovementItem),
    variableIncomes: summary.variableIncomes.map(toMovementItem),
    fixedExpenses: summary.fixedExpenses.map(toMovementItem),
    variableExpenses: summary.variableExpenses.map(toMovementItem),
    fixedIncomesTotal: summary.fixedIncomesTotal,
    variableIncomesTotal: summary.variableIncomesTotal,
    fixedExpensesTotal: summary.fixedExpensesTotal,
    variableExpensesTotal: summary.variableExpensesTotal,
  };
}
