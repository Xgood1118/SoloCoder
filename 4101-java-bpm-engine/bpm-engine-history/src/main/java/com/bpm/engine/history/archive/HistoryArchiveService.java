package com.bpm.engine.history.archive;

import java.time.LocalDateTime;

public interface HistoryArchiveService {

    void archiveProcessInstances(LocalDateTime before, int batchSize);

    void archiveByProcessKey(String processKey, LocalDateTime before, int batchSize);

    void cleanupArchivedData(LocalDateTime before, int batchSize);
}
