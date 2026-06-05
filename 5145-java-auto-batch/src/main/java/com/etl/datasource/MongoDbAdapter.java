package com.etl.datasource;

import com.etl.model.DataSourceConfig;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

public class MongoDbAdapter extends AbstractDataSourceAdapter {

    private MongoClient mongoClient;
    private MongoDatabase mongoDatabase;

    @Override
    protected void doConnect(DataSourceConfig config) throws Exception {
        String connectionString = String.format("mongodb://%s:%s@%s:%d/%s",
                config.getUsername(), config.getPassword(), config.getHost(), config.getPort(), config.getDatabaseName());
        this.mongoClient = MongoClients.create(connectionString);
        this.mongoDatabase = mongoClient.getDatabase(config.getDatabaseName());
        mongoDatabase.listCollectionNames().first();
    }

    @Override
    protected void doDisconnect() {
        if (mongoClient != null) {
            mongoClient.close();
        }
    }

    @Override
    public Iterator<Map<String, Object>> executeQuery(String query) {
        MongoCollection<Document> collection = mongoDatabase.getCollection(query);
        Iterator<Document> mongoIterator = collection.find().iterator();
        return new MongoIterator(mongoIterator);
    }

    @Override
    public void executeWrite(String targetTable, List<Map<String, Object>> records, List<String> columnOrder) {
        if (records == null || records.isEmpty()) {
            return;
        }

        MongoCollection<Document> collection = mongoDatabase.getCollection(targetTable);
        List<Document> documents = new ArrayList<>();
        for (Map<String, Object> record : records) {
            Document doc = new Document();
            for (String column : columnOrder) {
                doc.put(column, record.get(column));
            }
            documents.add(doc);
        }
        collection.insertMany(documents);
    }

    @Override
    public String getAdapterType() {
        return "MONGODB";
    }

    private static class MongoIterator implements Iterator<Map<String, Object>> {

        private final Iterator<Document> mongoIterator;

        MongoIterator(Iterator<Document> mongoIterator) {
            this.mongoIterator = mongoIterator;
        }

        @Override
        public boolean hasNext() {
            return mongoIterator.hasNext();
        }

        @Override
        public Map<String, Object> next() {
            if (!mongoIterator.hasNext()) {
                throw new NoSuchElementException();
            }
            Document doc = mongoIterator.next();
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : doc.entrySet()) {
                row.put(entry.getKey(), entry.getValue());
            }
            return row;
        }
    }
}
