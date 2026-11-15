-- Non-destructive migration: allow incomplete TravelRequest drafts without dates, destination, purpose, or budget until submission/approval
ALTER TABLE "travel_requests"
  ALTER COLUMN "origin" SET DEFAULT 'iSysware HQ',
  ALTER COLUMN "destination" SET DEFAULT '',
  ALTER COLUMN "purpose" SET DEFAULT '',
  ALTER COLUMN "departureDate" DROP NOT NULL,
  ALTER COLUMN "returnDate" DROP NOT NULL,
  ALTER COLUMN "estimatedBudget" DROP NOT NULL;

