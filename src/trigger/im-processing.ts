import { task, logger, metadata } from "@trigger.dev/sdk";
import { processIM, scanAndProcessFolder, reprocessAllFiles, processSingleGdriveFile, MODEL_ID } from "@/lib/agents/im-processor";

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
