-- Drop promptText now that prompt linkage is stored via promptId
ALTER TABLE "llm_requests" DROP COLUMN "promptText";
