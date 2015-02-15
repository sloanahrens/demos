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
        domain = 'localhost:8000'
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

app.register_blueprint(static.static)

# Boilerplate
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-p', '--port')
    args = parser.parse_args()
    server_port = 8000

    if args.port:
        server_port = int(args.port)

    app.run(host='0.0.0.0', port=server_port, debug=app_config.DEBUG)
