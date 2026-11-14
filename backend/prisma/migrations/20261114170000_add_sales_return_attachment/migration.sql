-- Links a Sales Return to the generic Attachment store (photo evidence).
ALTER TABLE "SalesReturn" ADD COLUMN "AttachmentEntry" INTEGER;
