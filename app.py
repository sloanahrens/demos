#!/usr/bin/env python

import json

import argparse
from flask import Flask, render_template

import app_config
from render_utils import make_context, smarty_filter, urlencode_filter
import static

app = Flask(__name__)

app.jinja_env.filters['smarty'] = smarty_filter
app.jinja_env.filters['urlencode'] = urlencode_filter

@app.context_processor
def inject_endpoint():
    if app_config.DEPLOYMENT_TARGET == 'production':
        domain = app_config.PRODUCTION_SERVERS[0]
        method = 'http'
    elif app_config.DEPLOYMENT_TARGET == 'staging':
        domain = app_config.STAGING_SERVERS[0]
        method = 'http'
    else:
        domain = 'localhost:8005'
        method = 'http'

    return { 'ajax_endpoint': '%s://%s/%s' % (method, domain, app_config.PROJECT_SLUG) }



################################
# static routes

# Example application views
# @app.route('/')
# def index():
#     """
#     Example view demonstrating rendering a simple HTML page.
#     """
#     context = make_context()

#     with open('data/featured.json') as f:
#         context['featured'] = json.load(f)

#     return render_template('index.html', **context)
    
@app.route('/index.html')
def index():
    return render_template('index.html', **make_context())

@app.route('/widget.html')
def widget():
    """
    Embeddable widget example page.
    """
    return render_template('widget.html', **make_context())


@app.route('/picker.html')
def picker():
    return render_template('picker_template.html', **make_context())

@app.route('/mmstats.html')
def mmstats():
    return render_template('mm_stats_template.html', **make_context())


################################


################################
# AJAX routes
# publish in public_app.py
# will throw exception if attempt to publish in app.py

from flask import request, jsonify
from elasticsearch import Elasticsearch

from modules.picker_data import ES_HOST, MOVING_AVERAGE_WEEKS, INDEX_TICKERS, \
    DAILY_ANALYTICS_INDEX_NAME, DAILY_QUOTES_INDEX_NAME, TICKER_SYMBOLS_INDEX_NAME, LOG_INDEX_NAME
from modules.picker_data import get_moving_average_key, add_new_ticker

DECIMAL_DIGITS = 4


# search ticker data
@app.route('/%s/tickerdata' % app_config.PROJECT_SLUG, methods=['POST', 'OPTION'])
def search_ticker_data():
    #json = request.get_json(force=True, silent=False, cache=False)
    es_client = Elasticsearch(hosts = [ES_HOST])

    es_res = es_client.search(index=DAILY_ANALYTICS_INDEX_NAME, 
                              doc_type=request.json['ticker'].lower(),
                              body=request.json['es_request'])

    res_data = [{
        'd': hit['_source']['date'],
        'ac': round(hit['_source']['adj_close'], DECIMAL_DIGITS),
        # 'ac_sr': round(hit['_source']['adj_close_simp_ret'], DECIMAL_DIGITS),
        # 'ac_cr': round(hit['_source']['adj_close_cc_ret'], DECIMAL_DIGITS),
        'iac': round(hit['_source']['index_adj_close'], DECIMAL_DIGITS),
        'sac': round(hit['_source']['scaled_adj_close'], DECIMAL_DIGITS),
        # 'sac_sr': round(hit['_source']['scaled_adj_close_simp_ret'], DECIMAL_DIGITS),
        # 'sac_cr': round(hit['_source']['scaled_adj_close_cc_ret'], DECIMAL_DIGITS),
        'sac_ma': round(hit['_source'][get_moving_average_key('scaled_adj_close')]['mean'], DECIMAL_DIGITS),

        # 'd_sacma': round(hit['_source']['grad_scaled_adj_close_ma'], DECIMAL_DIGITS),
        
        # 'ac_cr_ma': round(hit['_source'][get_moving_average_key('adj_close_cc_ret')]['mean'], DECIMAL_DIGITS),
        # 'sac_sr_ma': round(hit['_source'][get_moving_average_key('scaled_adj_close_simp_ret')]['mean'], DECIMAL_DIGITS),
        # 'sac_cr_ma': round(hit['_source'][get_moving_average_key('scaled_adj_close_cc_ret')]['mean'], DECIMAL_DIGITS)

    } for hit in es_res['hits']['hits']]

    return(jsonify({ 
        'success': True, 
        'ticker': request.json['ticker'],
        'index': 'SPY',
        'avg_weeks': MOVING_AVERAGE_WEEKS,
        'results': res_data 
    }))


@app.route('/%s/tickerlist' % app_config.PROJECT_SLUG, methods=['GET'])
def get_tickerlist():
    es_client = Elasticsearch(hosts = [ES_HOST])
    es_res = es_client.search(index=TICKER_SYMBOLS_INDEX_NAME, 
                              doc_type='ticker',
                              body={
                                  "size": 1000, 
                                  "query": { "match_all": {} },
                                  "filter": { "term": { "is_index": False } },
                                  "sort": [{  "symbol": { "order": "asc" } }]
                              })
    return(jsonify({'tickers': [t['_source']['symbol'] for t in es_res['hits']['hits']]}))

@app.route('/%s/addticker' % app_config.PROJECT_SLUG, methods=['POST', 'OPTION'])
def add_ticker():
    es_client = Elasticsearch(hosts = [ES_HOST])
    try:
        # raise Exception('Test Exception')
        add_new_ticker(es_client, request.json['ticker'].upper())
        return(jsonify({ 'success': True }))
    except Exception, e:
        return(jsonify({ 'success': False, 'msg': str(e) }))

@app.route('/%s/recommendations' % app_config.PROJECT_SLUG, methods=['GET'])
def get_recommendations():
    es_client = Elasticsearch(hosts = [ES_HOST])
    es_res = es_client.search(index=LOG_INDEX_NAME, 
                              body={
                                "size": 1,
                                "query": { "match_all" : {} },
                                "sort": [ { "latest_data_date": { "order": "desc" } } ]
                              })
    latest_log = es_res['hits']['hits'][0]['_source']

    es_res = es_client.search(index=DAILY_ANALYTICS_INDEX_NAME, body={
       "size": 1000,
       "query": {
          "filtered": {
             "query": {
                "match_all": {}
             },
             "filter": {
                "bool": {
                   "must": [
                      {
                         "range": {
                            "date": { "gte": latest_log['latest_data_date'] }
                         }
                      },
                      {
                          "range": {
                             "sac_to_sacma_ratio": { "gt": 1 }
                          }
                      }
                   ]
                }
             }
          }
       },
       "sort": [
          {
             "sac_to_sacma_ratio": {
                "order": "desc"
             }
          }
       ]
    })
    sell_hits = [{
        'sym': hit['_type'].upper(),
        'd': hit['_source']['date'],
        'ac': round(hit['_source']['adj_close'], DECIMAL_DIGITS),
        'iac': round(hit['_source']['index_adj_close'], DECIMAL_DIGITS),
        'sac': round(hit['_source']['scaled_adj_close'], DECIMAL_DIGITS),
        'sac_ma': round(hit['_source'][get_moving_average_key('scaled_adj_close')]['mean'], DECIMAL_DIGITS),
        'ratio': round(hit['_source']['sac_to_sacma_ratio'], DECIMAL_DIGITS)
    } for hit in es_res['hits']['hits']]

    es_res = es_client.search(index=DAILY_ANALYTICS_INDEX_NAME, body={
       "size": 1000,
       "query": {
          "filtered": {
             "query": {
                "match_all": {}
             },
             "filter": {
                "bool": {
                   "must": [
                      {
                         "range": {
                            "date": { "gte": latest_log['latest_data_date'] }
                         }
                      },
                      {
                          "range": {
                             "sac_to_sacma_ratio": { "lt": 1 }
                          }
                      },
                      {
                          "term": {
                             "gt_ma_in_last_period": True
                          }
                      }
                   ]
                }
             }
          }
       },
       "sort": [
          {
             "sac_to_sacma_ratio": {
                "order": "asc"
             }
          }
       ]
    })
    buy_hits = [{
        'sym': hit['_type'].upper(),
        'd': hit['_source']['date'],
        'ac': round(hit['_source']['adj_close'], DECIMAL_DIGITS),
        'iac': round(hit['_source']['index_adj_close'], DECIMAL_DIGITS),
        'sac': round(hit['_source']['scaled_adj_close'], DECIMAL_DIGITS),
        'sac_ma': round(hit['_source'][get_moving_average_key('scaled_adj_close')]['mean'], DECIMAL_DIGITS),
        'ratio': round(hit['_source']['sac_to_sacma_ratio'], DECIMAL_DIGITS)
    } for hit in es_res['hits']['hits']]

    return(jsonify({
        'latest_data_date': latest_log['latest_data_date'],
        'sell_hits': sell_hits,
        'buy_hits': buy_hits
    }))

# end AJAX routes
################################


################################

app.register_blueprint(static.static)

# Boilerplate
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-p', '--port')
    args = parser.parse_args()
    server_port = 8005

    if args.port:
        server_port = int(args.port)

    app.run(host='0.0.0.0', port=server_port, debug=app_config.DEBUG)
