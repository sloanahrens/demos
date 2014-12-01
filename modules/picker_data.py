
from slugify import slugify
from datetime import datetime, timedelta
from ystockquote import get_historical_prices
from pprint import pprint
import numpy as np
from scipy import stats
from math import log


# from modules.settings import *
# from modules.utility import *


### Settings

ES_HOST = {'host' : 'localhost', 'port' : 9200}

INDEX_SHARDS = 1
INDEX_REPLICAS = 0

TICKER_SYMBOLS_INDEX_NAME = 'picker_tickers_loaded'

DAILY_QUOTES_INDEX_NAME = 'picker_daily_quotes'

DAILY_ANALYTICS_INDEX_NAME = 'picker_daily_analytics'


WEEKS_TO_DOWNLOAD = 260

MOVING_AVERAGE_WEEKS = 86

INDEX_TICKERS = ['SPY']

STARTING_TICKERS = ['GOOGL', 'AMZN', 'AAPL']

WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

QUOTES_MAPPING_PROPERTIES = {
   "properties": {
      "adj_close": {
         "type": "double"
      },
      "close": {
         "type": "double"
      },
      "date": {
         "type": "date",
         "format": "dateOptionalTime"
      },
      "day_of_week": {
         "type": "string", 
         "index": "not_analyzed"
      },
      "high": {
         "type": "double"
      },
      "low": {
         "type": "double"
      },
      "open": {
         "type": "double"
      },
      "quote_id": {
         "type": "string", 
         "index": "not_analyzed"
      },
      "volume": {
         "type": "long"
      }
   }
}

##########



### Utility

def getIndexDict(es_client, index_name, doc_type, doc_count, query_body):
    data_dict = {}
    res = es_client.search(index=index_name, doc_type=doc_type, size=doc_count, body={
        "query": query_body
    })
    for hit in res["hits"]["hits"]:
        data_dict[hit["_id"]] = hit["_source"]
    return data_dict

def getIndexDocCount(es_client, index_name, doc_type):
    res = es_client.search(index=index_name, doc_type=doc_type, size=0, body={ "query": { "match_all": {} } })
    doc_count = res["hits"]["total"]
    return doc_count

def add_bulk_insert_doc_to_list(bulk_data, index_name, type_name, doc, doc_id=None):
    op_dict = {
        "index": {
            "_index": index_name, 
            "_type": type_name
        }
    }
    if doc_id:
        op_dict["index"]["_id"] = doc_id
    bulk_data.append(op_dict)
    bulk_data.append(doc)


def create_index(es_client, index_name):
    # delete index if it exists
    if es_client.indices.exists(index_name):
        print("deleting '%s'" % (index_name))
        res = es_client.indices.delete(index = index_name)

    create_request_body = {
        "settings" : {
            "index" : {
                "number_of_shards": INDEX_SHARDS,
                "number_of_replicas": INDEX_REPLICAS
            }
        }
    }

    # create index
    print("creating '%s'" % (index_name))
    res = es_client.indices.create(index = index_name, body = create_request_body)
    print(" response: '%s'" % (res))

##########


def build_tickers_index(es_client):

    create_index(es_client, TICKER_SYMBOLS_INDEX_NAME)

    print('adding mapping for %s' % 'ticker')
    res = es_client.indices.put_mapping(index=TICKER_SYMBOLS_INDEX_NAME, doc_type='ticker', body={
        'ticker': {
            "properties": {
                "added": {
                    "type": "date",
                    "format": "dateOptionalTime"
                },
                "is_index": {
                    "type": "boolean"
                },
                "symbol": {
                    "type": "string", 
                    "index": "not_analyzed"
                }
            }
        }
    })

    today = datetime.now().strftime('%Y-%m-%d')

    bulk_data = []

    for symbol in INDEX_TICKERS + STARTING_TICKERS:

        ticker_doc = {
            'symbol': symbol,
            'is_index': symbol in INDEX_TICKERS,
            'added': today
        }

        add_bulk_insert_doc_to_list(bulk_data=bulk_data, 
                                        index_name=TICKER_SYMBOLS_INDEX_NAME, 
                                        type_name='ticker', 
                                        doc=ticker_doc, 
                                        doc_id=symbol.lower())

    print('bulk indexing into %s' % (TICKER_SYMBOLS_INDEX_NAME))
    res = es_client.bulk(index = TICKER_SYMBOLS_INDEX_NAME, body = bulk_data, refresh = True)
    # for line in res["items"]:
    #     print(line)
    print('errors: %s' % res['errors'])


def build_quotes_index(es_client):

    create_index(es_client, DAILY_QUOTES_INDEX_NAME)

    create_index(es_client, DAILY_ANALYTICS_INDEX_NAME)

    es_res = es_client.search(index=TICKER_SYMBOLS_INDEX_NAME, 
                              doc_type='ticker',
                              body={ "size": 1000, "query": { "match_all": {}} })
    tickers = [t['_source']['symbol'] for t in es_res['hits']['hits']]

    print(tickers)

    add_ticker_data(es_client, INDEX_TICKERS[0])

    sorted_price_index_docs = get_sorted_index_docs(es_client, INDEX_TICKERS[0])

    for symbol in tickers:
        add_ticker_data(es_client, symbol, sorted_price_index_docs)


def add_new_ticker(es_client, symbol):

    add_ticker_data(es_client, INDEX_TICKERS[0])

    sorted_price_index_docs = get_sorted_index_docs(es_client, INDEX_TICKERS[0])

    add_ticker_data(es_client, symbol, sorted_price_index_docs)

    ticker_doc = {
        'symbol': symbol,
        'is_index': symbol in INDEX_TICKERS,
        'added': datetime.now().strftime('%Y-%m-%d')
    }
    es_client.index(index=TICKER_SYMBOLS_INDEX_NAME, 
                    doc_type='ticker', 
                    id=symbol.lower(),
                    body=ticker_doc,
                    refresh=True)


def get_sorted_index_docs(es_client, index_symbol):

    price_index_type = index_symbol.lower()
    # print(price_index_type)
    price_index_doc_count = getIndexDocCount(es_client, DAILY_QUOTES_INDEX_NAME, price_index_type)
    price_index_doc_dict = getIndexDict(es_client=es_client, 
                                        index_name=DAILY_QUOTES_INDEX_NAME, 
                                        doc_type=price_index_type, 
                                        doc_count=price_index_doc_count,
                                        query_body={ "match_all": {} })
    sorted_price_index_docs = [price_index_doc_dict[key] for key in sorted(price_index_doc_dict.keys())]
    # print(price_index_doc_count, len(price_index_doc_dict))
    # pprint(sorted(price_index_doc_dict.keys()))
    return sorted_price_index_docs


def get_moving_average_key(quantity_name):
    return('%s_%s_week_stats' % (quantity_name, MOVING_AVERAGE_WEEKS))



def update_doc_ma_stats(doc, quantity_name, doc_set):
    n, min_max, mean, var, skew, kurt = stats.describe([j[quantity_name] for j in doc_set])
    doc[get_moving_average_key(quantity_name)] = {
        'n': n,
        'min': min_max[0],
        'max': min_max[1],
        'mean': mean,
        'var': var,
        'skew': skew,
        'kurt': kurt
    }


def add_ticker_data(es_client, symbol, sorted_price_index_docs=None):

    today = datetime.now()
    today_date = today.strftime('%Y-%m-%d')

    start = today + timedelta(weeks=-WEEKS_TO_DOWNLOAD)
    start_date = start.strftime('%Y-%m-%d')

    print('getting quotes for %s from %s to %s' % (symbol, start_date, today_date))
    quotes = get_historical_prices(symbol, start_date, today_date)
    print('%s quotes found' % len(quotes))

    type_name = symbol.lower()

    bulk_data = []

    last_doc = None

    for date in sorted(quotes.keys()):
        quote = quotes[date]
        # print(quote)
        quote_id = '%s-%s' % (symbol, date)
        date_split = (int(i) for i in date.split('-'))
        day_of_week = WEEKDAYS[datetime(*date_split).weekday()]
        # print('%s, %s, %s' % (date, quote_id, day_of_week))
        quote_doc = { 
            'quote_id': quote_id, 
            'date': date,
            'day_of_week': day_of_week 
            }
        for prop in quote:
            field_name = slugify(prop).replace('-', '_')
            quote_doc[field_name] = float(quote[prop])

        add_bulk_insert_doc_to_list(bulk_data=bulk_data, 
                                    index_name=DAILY_QUOTES_INDEX_NAME, 
                                    type_name=type_name, 
                                    doc=quote_doc, 
                                    doc_id=quote_id)


    # print('adding mapping for %s' % type_name)
    res = es_client.indices.put_mapping(index=DAILY_QUOTES_INDEX_NAME, doc_type=type_name, body={
        type_name: QUOTES_MAPPING_PROPERTIES
    })

    print('bulk indexing into %s' % (DAILY_QUOTES_INDEX_NAME))
    res = es_client.bulk(index = DAILY_QUOTES_INDEX_NAME, body = bulk_data, refresh = True)
    # for line in res["items"]:
    #     print(line)
    if res['errors'] > 0:
        print('errors: %s' % res['errors'])

    ## analytics

    if sorted_price_index_docs is None:
        return

    today_day_of_week = today.weekday()
    # print('today: %s' % today_date)

    data_start = today + timedelta(weeks=-WEEKS_TO_DOWNLOAD) + timedelta(days=-today_day_of_week)
    data_start_date = data_start.strftime('%Y-%m-%d')
    # print('data begins: %s' % data_start_date)

    analytics_start = data_start + timedelta(weeks=MOVING_AVERAGE_WEEKS)
    analytics_start_date = analytics_start.strftime('%Y-%m-%d')
    # print('analytics begins: %s' % analytics_start_date)

    type_name = symbol.lower()
    doc_count = getIndexDocCount(es_client, DAILY_QUOTES_INDEX_NAME, type_name)
    doc_dict = getIndexDict(es_client=es_client, 
                            index_name=DAILY_QUOTES_INDEX_NAME, 
                            doc_type=type_name, 
                            doc_count=doc_count, 
                            query_body={ "match_all": {} })
    # print(doc_count, len(doc_dict))
    # pprint(sorted(doc_dict.keys()))
    sorted_docs = [doc_dict[key] for key in sorted(doc_dict.keys())]
    # pprint(sorted_docs)
    start_index = 0
    bulk_data = []
    # print('%s sorted_docs, %s sorted_price_index_docs' % (len(sorted_docs), len(sorted_price_index_docs)))
    # print(sorted_docs[0])
    # print(sorted_price_index_docs[0])
    # print(sorted_docs[-1])
    # print(sorted_price_index_docs[-1])


    last_doc = None

    for i in range(len(sorted_docs)):

        analytics_doc = sorted_docs[i]
        if i == len(sorted_price_index_docs):
            print(sorted_docs[len(sorted_price_index_docs):-1])
            break
        price_index_doc = sorted_price_index_docs[i]
        analytics_doc['index_adj_close'] = price_index_doc['adj_close']
        analytics_doc['scaled_adj_close'] = analytics_doc['adj_close'] / price_index_doc['adj_close']

        if last_doc is None:
            analytics_doc["adj_close_simp_ret"] = 0
            analytics_doc["adj_close_cc_ret"] = 0
            # analytics_doc["scaled_adj_close_simp_ret"] = 0
            # analytics_doc["scaled_adj_close_cc_ret"] = 0
        else:
            analytics_doc["adj_close_simp_ret"] = (analytics_doc["adj_close"] - last_doc["adj_close"]) / last_doc["adj_close"]
            analytics_doc["adj_close_cc_ret"] = log(analytics_doc["adj_close"] / last_doc["adj_close"])

            # analytics_doc["scaled_adj_close_simp_ret"] = \
            #     (analytics_doc["scaled_adj_close"] - last_doc["scaled_adj_close"]) / last_doc["scaled_adj_close"]

            # analytics_doc["scaled_adj_close_cc_ret"] = log(analytics_doc["scaled_adj_close"] / last_doc["scaled_adj_close"])
        last_doc = analytics_doc

        if analytics_doc['date'] < analytics_start_date:
            continue
        
        avg_start = datetime(*(int(j) for j in analytics_doc['date'].split('-'))) 
        avg_start = avg_start + timedelta(weeks=-MOVING_AVERAGE_WEEKS)
        avg_start_date = avg_start.strftime('%Y-%m-%d')
        # print('%s' % avg_start_date)
        while sorted_docs[start_index]['date'] < avg_start_date:
            start_index += 1
        docs_to_average = sorted_docs[start_index:i+1]
        # print(docs_to_average)

        # update_doc_ma_stats(analytics_doc, 'adj_close', docs_to_average)
        # update_doc_ma_stats(analytics_doc, 'adj_close_simp_ret', docs_to_average)
        # update_doc_ma_stats(analytics_doc, 'adj_close_cc_ret', docs_to_average)

        update_doc_ma_stats(analytics_doc, 'scaled_adj_close', docs_to_average)
        # update_doc_ma_stats(analytics_doc, 'scaled_adj_close_simp_ret', docs_to_average)
        # update_doc_ma_stats(analytics_doc, 'scaled_adj_close_cc_ret', docs_to_average)
        
        #print('%s, %s, %s' % (docs_to_average[0]['date'], docs_to_average[-1]['date'], analytics_doc['date']))



        quote_id = '%s-%s' % (symbol, analytics_doc['date'])
        add_bulk_insert_doc_to_list(bulk_data=bulk_data, 
                                    index_name=DAILY_ANALYTICS_INDEX_NAME, 
                                    type_name=type_name, 
                                    doc=analytics_doc, 
                                    doc_id=quote_id)
    # print('adding mapping for %s' % type_name)
    # res = es_client.indices.put_mapping(index=DAILY_QUOTES_INDEX_NAME, doc_type=type_name, body={
    #     type_name: QUOTES_MAPPING_PROPERTIES
    # })
    print('bulk indexing into %s, type %s' % (DAILY_ANALYTICS_INDEX_NAME, type_name))
    res = es_client.bulk(index = DAILY_ANALYTICS_INDEX_NAME, body = bulk_data, refresh = True)
    # for line in res["items"]:
    #     print(line)
    if res['errors'] > 0:
        print('errors: %s' % res['errors'])


    # >>> x = np.array([0, 1, 2, 3, 4])
    # >>> dx = np.gradient(x)
    # >>> y = x**2
    # >>> np.gradient(y, dx)
    # array([-0.,  2.,  4.,  6.,  8.])

    doc_count = getIndexDocCount(es_client, DAILY_ANALYTICS_INDEX_NAME, type_name)
    es_res = es_client.search(index=DAILY_ANALYTICS_INDEX_NAME, 
                              doc_type=type_name,
                              body={
                                "from": 0,
                                "size": doc_count,
                                "query": { "match_all" : {} },
                                "sort": [ { "date": { "order": "asc" } } ]
                              })
    sorted_docs = [hit['_source'] for hit in es_res['hits']['hits']]

    # print(sorted_docs[0], sorted_docs[1])

    t = [int(datetime.strptime(doc['date'], "%Y-%m-%d").strftime("%s")) / 86400 for doc in sorted_docs]
    print(t[0], t[-1])

    dt = np.gradient(t)
    # print(dt[0], dt[-1])
    # print(dt)

    sacma = [doc[get_moving_average_key('scaled_adj_close')]['mean'] for doc in sorted_docs]
    # print(sacma[0], sacma[-1])

    d_sacma = np.gradient(sacma)
    # print(d_sacma[0], d_sacma[-1])

    d_sacma_dt = np.gradient(sacma, dt)
    # print(d_sacma_dt[0], d_sacma_dt[-1])

    bulk_data = []
    for i in range(len(sorted_docs)):

        doc = sorted_docs[i]

        doc['grad_scaled_adj_close_ma'] = d_sacma[i]
        doc['time_grad_scaled_adj_close_ma'] = d_sacma_dt[i]

        quote_id = '%s-%s' % (symbol, doc['date'])

        add_bulk_insert_doc_to_list(bulk_data=bulk_data, 
                                    index_name=DAILY_ANALYTICS_INDEX_NAME, 
                                    type_name=type_name, 
                                    doc=doc, 
                                    doc_id=quote_id)

    print('bulk indexing into %s, type %s' % (DAILY_ANALYTICS_INDEX_NAME, type_name))
    res = es_client.bulk(index = DAILY_ANALYTICS_INDEX_NAME, body = bulk_data, refresh = True)
    if res['errors'] > 0:
        print('errors: %s' % res['errors'])




    
# import ystockquote
# from datetime import datetime, timedelta
# from pprint import pprint

# price = ystockquote.get_price('GOOG')
# print(price)

# # error due to bad ticker symbol: urllib2.HTTPError: HTTP Error 404: Not Found 
# # pprint(ystockquote.get_historical_prices('GOOG', '2013-01-03', '2013-01-08'))

# today = datetime.now()

# print(today.strftime('%Y-%m-%d'))

# a_year_ago = datetime.now() + timedelta(weeks=-52)

# a_week_ago = datetime.now() + timedelta(weeks=-1)

# print(a_year_ago.strftime('%Y-%m-%d'))


# hist = ystockquote.get_historical_prices('SPY', a_year_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d'))
# # print(hist)
# pprint(len(hist))
# pprint(type(hist))

# hist = ystockquote.get_historical_prices('SPY', a_week_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d'))
# pprint(hist)