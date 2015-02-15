
from elasticsearch import Elasticsearch
from modules.picker_data import ES_HOST, LOG_INDEX_NAME 
from modules.picker_data import build_tickers_index, build_quotes_index

ticker_file = '/home/sloan/local_code/demos/tickers.txt'

es_client = Elasticsearch(hosts = [ES_HOST])


if es_client.indices.exists(LOG_INDEX_NAME):
    print("deleting '%s'" % (LOG_INDEX_NAME))
    es_client.indices.delete(index = LOG_INDEX_NAME)
print("creating '%s'" % (LOG_INDEX_NAME))
res = es_client.indices.create(index = LOG_INDEX_NAME, body = {
   "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1
   },
   "mappings": {
      "log": {
         "properties": {
            "update_date": {
               "type": "date",
               "format": "yyyy-MM-dd HH:mm:ss"
            },
            "latest_data_date": {
                "type": "date",
                "format": "yyyy-MM-dd"
            }
         }
      }
   }
})
print(" response: '%s'" % (res))


#build_tickers_index(es_client)
build_tickers_index(es_client, ticker_file)

build_quotes_index(es_client)
