ALTER TABLE "fixed_expenses" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD COLUMN "exchange_rate" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "fixed_incomes" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "fixed_incomes" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "fixed_incomes" ADD COLUMN "exchange_rate" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "variable_expenses" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "variable_expenses" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "variable_expenses" ADD COLUMN "exchange_rate" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "variable_incomes" ADD COLUMN "original_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "variable_incomes" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "variable_incomes" ADD COLUMN "exchange_rate" numeric(12, 4);