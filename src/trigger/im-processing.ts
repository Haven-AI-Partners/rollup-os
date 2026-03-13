import { task, logger, metadata, schedules } from "@trigger.dev/sdk";
import { processIM, scanAndProcessFolder, reprocessAllFiles, processSingleGdriveFile, MODEL_ID } from "@/lib/agents/im-processor";
import { runEval } from "@/lib/agents/im-processor/eval";
import { db } from "@/lib/db";
import { portcos } from "@/lib/db/schema";
import { and, isNotNull } from "drizzle-orm";

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

/** Scan GDrive folder and process all new IMs */
export const scanFolderTask = task({
  id: "scan-gdrive-folder",
  maxDuration: 600, // 10 minutes for batch
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: { portcoId: string }) => {
    logger.info("Scanning GDrive folder", { portcoId: payload.portcoId });

    const result = await scanAndProcessFolder(payload.portcoId);

    logger.info("Folder scan complete", {
      totalFiles: result.totalFiles,
      newFiles: result.newFiles,
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
    });

    return result;
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
    } else {
      logger.error("GDrive file processing failed", { error: result.error });
    }

    return result;
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

/** Scheduled: scan all GDrive-connected portcos for new IMs every 15 minutes */
export const scheduledGdriveScan = schedules.task({
  id: "scheduled-gdrive-scan",
  cron: {
    pattern: "*/15 * * * *",
    timezone: "Asia/Tokyo",
  },
  maxDuration: 600,
  retry: {
    maxAttempts: 1,
  },
  run: async () => {
    // Find all portcos with GDrive connected
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
      return { scanned: 0, results: [] };
    }

    logger.info(`Scanning ${connectedPortcos.length} portco(s) for new IMs`);

    const results = [];
    for (const portco of connectedPortcos) {
      try {
        const result = await scanAndProcessFolder(portco.id);
        logger.info(`Scan complete for ${portco.name}`, {
          newFiles: result.newFiles,
          processed: result.processed,
          failed: result.failed,
        });
        results.push({ portcoId: portco.id, name: portco.name, ...result });
      } catch (error) {
        logger.error(`Scan failed for ${portco.name}`, {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        results.push({ portcoId: portco.id, name: portco.name, error: true });
      }
    }

    return { scanned: connectedPortcos.length, results };
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
