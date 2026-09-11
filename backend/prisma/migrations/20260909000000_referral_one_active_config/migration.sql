CREATE UNIQUE INDEX "referral_program_configs_one_active_idx"
ON "referral_program_configs" ("isActive")
WHERE "isActive" = true;