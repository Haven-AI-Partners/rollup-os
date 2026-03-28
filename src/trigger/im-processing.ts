import { task, logger, metadata, schedules, tasks } from "@trigger.dev/sdk";
import { processIM, reprocessAllFiles, processSingleGdriveFile, MODEL_ID } from "@/lib/agents/im-processor";
import { runEval } from "@/lib/agents/im-processor/eval";
import { scanClassifyAndProcessIncremental } from "@/lib/agents/scan-orchestrator";
import { processDDDocument } from "@/lib/agents/dd-processor";
import { autoGenerateThesisTree } from "@/lib/actions/thesis";
import { db } from "@/lib/db";
import { portcos } from "@/lib/db/schema";
import { and, isNotNull } from "drizzle-orm";
import type { FileType } from "@/lib/db/schema/files";
import { registerGdriveErrorLogger, unregisterGdriveErrorLogger } from "@/lib/gdrive/error-logger";

/** Generate DD thesis tree for a deal (runs after IM processing) */
export const generateThesisTreeTask = task({
  id: "generate-thesis-tree",
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: { dealId: string; portcoId: string }) => {
    logger.info("Generating thesis tree", { dealId: payload.dealId });

    const count = await autoGenerateThesisTree(payload.dealId, payload.portcoId);

    logger.info("Thesis tree generated", { dealId: payload.dealId, nodesCreated: count });
    return { dealId: payload.dealId, nodesCreated: count };
  },
});

/** Process a single IM file */
export const processIMTask = task({
  id: "process-im",
  maxDuration: 600, // 10 minutes
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: { fileId: string; dealId: string; portcoId: string }) => {
    logger.info("Processing IM file", { fileId: payload.fileId, dealId: payload.dealId });

    const result = await processIM(payload);

    if (result.success) {
      logger.info("IM processed successfully", {
        profileId: result.profileId,
        overallScore: result.overallScore,
        redFlagCount: result.redFlagCount,
      });
    } else {
      logger.error("IM processing failed", { error: result.error });
    }

    return result;
  },
});

/** Time budget for incremental scan (8 minutes, leaving 2 min buffer) */
const INCREMENTAL_SCAN_BUDGET_MS = 480_000;

/** Scan GDrive folder incrementally and process new IMs */
export const scanFolderTask = task({
  id: "scan-gdrive-folder",
  maxDuration: 600, // 10 minutes for batch
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: { portcoId: string }) => {
    logger.info("Scanning GDrive folder (incremental)", { portcoId: payload.portcoId });
    registerGdriveErrorLogger(payload.portcoId);

    try {
      const result = await scanClassifyAndProcessIncremental(
        payload.portcoId,
        INCREMENTAL_SCAN_BUDGET_MS,
      );

      logger.info("Incremental scan complete", {
        newFiles: result.newFiles,
        classified: result.classified,
        imsRouted: result.imsRouted,
        ddRouted: result.ddRouted,
        failed: result.failed,
        scanComplete: result.scanComplete,
        foldersErrored: result.foldersErrored,
      });

      return result;
    } finally {
      unregisterGdriveErrorLogger();
    }
  },
});

/** Process a single GDrive file: create deal, import, analyze */
export const processGdriveFileTask = task({
  id: "process-gdrive-file",
  maxDuration: 600, // 10 minutes
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: {
    portcoId: string;
    gdriveFileId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number | null;
    webViewLink: string | null;
    gdriveModifiedTime?: string | null;
    force?: boolean;
  }) => {
    logger.info("Processing single GDrive file", { fileName: payload.fileName, gdriveFileId: payload.gdriveFileId, model: MODEL_ID });
    registerGdriveErrorLogger(payload.portcoId);

    try {
      const result = await processSingleGdriveFile(payload, (step) => {
        metadata.set("step", step);
        logger.info(step);
      });

      if (result.success) {
        logger.info("GDrive file processed", {
          companyName: result.companyName,
          overallScore: result.overallScore,
          dealId: result.dealId,
        });

        // Trigger thesis tree generation as a separate task for new deals
        if (result.isNewDeal && result.dealId) {
          await tasks.trigger<typeof generateThesisTreeTask>("generate-thesis-tree", {
            dealId: result.dealId,
            portcoId: payload.portcoId,
          });
          logger.info("Triggered thesis tree generation", { dealId: result.dealId });
        }
      } else {
        logger.error("GDrive file processing failed", { error: result.error });
      }

      return result;
    } finally {
      unregisterGdriveErrorLogger();
    }
  },
});

/** Reprocess all previously completed IM files (e.g. after rubric/red flag changes) */
export const reprocessAllTask = task({
  id: "reprocess-all-ims",
  maxDuration: 900, // 15 minutes
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: { portcoId: string }) => {
    logger.info("Reprocessing all IM files", { portcoId: payload.portcoId });

    const result = await reprocessAllFiles(payload.portcoId);

    logger.info("Reprocessing complete", {
      total: result.total,
      processed: result.processed,
      failed: result.failed,
    });

    return result;
  },
});

/**
 * Scheduled: fan out incremental GDrive scans for each connected portco.
 * Each portco gets its own `scan-gdrive-folder` child task with a full 10-min window,
 * instead of sharing a single 10-min window across all portcos.
 */
export const scheduledGdriveScanTask = schedules.task({
  id: "scheduled-gdrive-scan",
  cron: {
    pattern: "*/15 * * * *",
    timezone: "Asia/Tokyo",
  },
  maxDuration: 120, // Only needs to trigger child tasks, not do the scanning
  retry: {
    maxAttempts: 1,
  },
  run: async () => {
    const connectedPortcos = await db
      .select({ id: portcos.id, name: portcos.name })
      .from(portcos)
      .where(
        and(
          isNotNull(portcos.gdriveFolderId),
          isNotNull(portcos.gdriveServiceAccountEnc),
        )
      );

    if (connectedPortcos.length === 0) {
      logger.info("No portcos with GDrive connected, skipping");
      return { scanned: 0, triggered: [] };
    }

    logger.info(`Triggering incremental scans for ${connectedPortcos.length} portco(s)`);

    const triggered: Array<{ portcoId: string; name: string }> = [];
    for (const portco of connectedPortcos) {
      try {
        await tasks.trigger<typeof scanFolderTask>("scan-gdrive-folder", {
          portcoId: portco.id,
        });
        triggered.push({ portcoId: portco.id, name: portco.name });
        logger.info(`Triggered scan for ${portco.name}`);
      } catch (e) {
        logger.error(`Failed to trigger scan for ${portco.name}`, {
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return { scanned: connectedPortcos.length, triggered };
  },
});

/** Process a DD document and enrich thesis tree */
export const processDDDocumentTask = task({
  id: "process-dd-document",
  maxDuration: 600,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: {
    fileId: string;
    dealId: string;
    portcoId: string;
    fileType: FileType;
  }) => {
    logger.info("Processing DD document", {
      fileId: payload.fileId,
      dealId: payload.dealId,
      fileType: payload.fileType,
    });

    const result = await processDDDocument(payload);

    if (result.success) {
      logger.info("DD document processed", {
        nodesUpdated: result.nodesUpdated,
        summary: result.summary,
      });
    } else {
      logger.error("DD processing failed", { error: result.error });
    }

    return result;
  },
});

/** Run consistency eval: process the same file N times and compare results */
export const runEvalTask = task({
  id: "run-im-eval",
  maxDuration: 1800, // 30 minutes (N iterations)
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: {
    evalRunId: string;
    fileId: string;
    portcoId: string;
    iterations: number;
  }) => {
    logger.info("Running IM eval", {
      evalRunId: payload.evalRunId,
      fileId: payload.fileId,
      iterations: payload.iterations,
    });

    const result = await runEval(
      payload.evalRunId,
      payload.fileId,
      payload.portcoId,
      payload.iterations,
    );

    if (result.status === "completed") {
      logger.info("Eval completed", { evalRunId: result.evalRunId });
    } else {
      logger.error("Eval failed", { error: result.error });
    }

    return result;
  },
});
