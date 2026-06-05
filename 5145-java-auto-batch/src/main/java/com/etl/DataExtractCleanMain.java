package com.etl;

import com.etl.engine.EtlEngine;
import com.etl.model.EtlTaskConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;

public class DataExtractCleanMain {

    private static final Logger logger = LoggerFactory.getLogger(DataExtractCleanMain.class);

    public static void main(String[] args) {
        if (args.length < 1) {
            logger.error("Usage: DataExtractCleanMain <configFilePath>");
            System.exit(1);
        }

        String configFilePath = args[0];
        EtlEngine engine = null;

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            EtlTaskConfig config = objectMapper.readValue(new File(configFilePath), EtlTaskConfig.class);

            engine = new EtlEngine(config);
            engine.initialize();
            engine.execute();
        } catch (Exception e) {
            logger.error("ETL task failed", e);
        } finally {
            if (engine != null) {
                engine.shutdown();
            }
        }
    }
}
