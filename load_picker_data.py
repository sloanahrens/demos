
from elasticsearch import Elasticsearch
from modules.picker_data import ES_HOST, build_tickers_index, build_quotes_index


es_client = Elasticsearch(hosts = [ES_HOST])

build_tickers_index(es_client)

build_quotes_index(es_client)
