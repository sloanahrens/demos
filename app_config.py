#!/usr/bin/env python

"""
Project-wide application configuration.

DO NOT STORE SECRETS, PASSWORDS, ETC. IN THIS FILE.
They will be exposed to users. Use environment variables instead.
See get_secrets() below for a fast way to access them.
"""

import os

"""
NAMES
"""
# Project name to be used in urls
# Use dashes, not underscores!
PROJECT_SLUG = 'demos'

# Project name to be used in file paths
PROJECT_FILENAME = 'demos'

# The name of the repository containing the source
REPOSITORY_NAME = 'demos'
GITHUB_USERNAME = 'sloanahrens'
REPOSITORY_URL = 'git@github.com:%s/%s.git' % (GITHUB_USERNAME, REPOSITORY_NAME)
REPOSITORY_ALT_URL = None # 'git@bitbucket.org:nprapps/%s.git' % REPOSITORY_NAME'

# Project name used for assets rig
# Should stay the same, even if PROJECT_SLUG changes
ASSETS_SLUG = 'demos'

"""
DEPLOYMENT
"""
PRODUCTION_S3_BUCKETS = [
    {
        'bucket_name': 'apps.sloanahrens.com',
        'region': 'us-west-2'
    },
    {
        'bucket_name': 'apps.sloanahrens.com',
        'region': 'us-west-2'
    }
]

STAGING_S3_BUCKETS = [
    {
        'bucket_name': 'apps.sloanahrens.com',
        'region': 'us-west-2'
    }
]

ASSETS_S3_BUCKET = {
    'bucket_name': 'apps.sloanahrens.com',
    'region': 'us-west-2'
}

PRODUCTION_SERVERS = ['cron.nprapps.org']
STAGING_SERVERS = ['50.112.92.131']

# Should code be deployed to the web/cron servers?
DEPLOY_TO_SERVERS = False

SERVER_USER = 'ubuntu'
SERVER_PYTHON = 'python2.7'
SERVER_PROJECT_PATH = '/home/%s/apps/%s' % (SERVER_USER, PROJECT_FILENAME)
SERVER_REPOSITORY_PATH = '%s/repository' % SERVER_PROJECT_PATH
SERVER_VIRTUALENV_PATH = '%s/virtualenv' % SERVER_PROJECT_PATH

# Should the crontab file be installed on the servers?
# If True, DEPLOY_TO_SERVERS must also be True
DEPLOY_CRONTAB = False

# Should the service configurations be installed on the servers?
# If True, DEPLOY_TO_SERVERS must also be True
DEPLOY_SERVICES = False

UWSGI_SOCKET_PATH = '/tmp/%s.uwsgi.sock' % PROJECT_FILENAME
UWSGI_LOG_PATH = '/var/log/%s.uwsgi.log' % PROJECT_FILENAME
APP_LOG_PATH = '/var/log/%s.app.log' % PROJECT_FILENAME

# Services are the server-side services we want to enable and configure.
# A three-tuple following this format:
# (service name, service deployment path, service config file extension)
SERVER_SERVICES = [
    ('app', SERVER_REPOSITORY_PATH, 'ini'),
    ('uwsgi', '/etc/init', 'conf'),
    ('nginx', '/etc/nginx/sites-available', 'conf'),
]

# These variables will be set at runtime. See configure_targets() below
S3_BUCKETS = []
S3_BASE_URL = ''
SERVERS = []
SERVER_BASE_URL = ''
DEBUG = True

"""
COPY EDITING
"""
COPY_GOOGLE_DOC_URL = 'https://docs.google.com/spreadsheet/ccc?key=1rqxnvuGWa5YrvSZDfsmewJaPKRR1Kl_e05NbuvlaGYg&usp=drive_web#gid=1'

COPY_PATH = 'data/copy.xlsx'

"""
SHARING
"""
SHARE_URL = 'http://%s/%s/' % (PRODUCTION_S3_BUCKETS[0], PROJECT_SLUG)

"""
ADS
"""

NPR_DFP = {
    'STORY_ID': '1002',
    'TARGET': 'homepage',
    'ENVIRONMENT': 'NPRTEST',
    'TESTSERVER': 'false'
}

"""
SERVICES
"""
GOOGLE_ANALYTICS = {
    'ACCOUNT_ID': 'none',
    'DOMAIN': PRODUCTION_S3_BUCKETS[0],
    'TOPICS': '' # e.g. '[1014,3,1003,1002,1001]'
}

DISQUS_API_KEY = 'tIbSzEhGBE9NIptbnQWn4wy1gZ546CsQ2IHHtxJiYAceyyPoAkDkVnQfCifmCaQW'
DISQUS_UUID = '6d03581c-7984-11e4-b91d-080027bd0047'

"""
Utilities
"""
def get_secrets():
    """
    A method for accessing our secrets.
    """
    secrets = [
        'EXAMPLE_SECRET'
    ]

    secrets_dict = {}

    for secret in secrets:
        name = '%s_%s' % (PROJECT_FILENAME, secret)
        secrets_dict[secret] = os.environ.get(name, None)

    return secrets_dict

def configure_targets(deployment_target):
    """
    Configure deployment targets. Abstracted so this can be
    overriden for rendering before deployment.
    """
    global S3_BUCKETS
    global S3_BASE_URL
    global SERVERS
    global SERVER_BASE_URL
    global DEBUG
    global DEPLOYMENT_TARGET
    global APP_LOG_PATH
    global DISQUS_SHORTNAME


    if deployment_target == 'production':
        S3_BUCKETS = PRODUCTION_S3_BUCKETS
        S3_BASE_URL = 'http://%s/%s' % (S3_BUCKETS[0]['bucket_name'], PROJECT_SLUG)
        SERVERS = PRODUCTION_SERVERS
        SERVER_BASE_URL = 'http://%s/%s' % (SERVERS[0], PROJECT_SLUG)
        DISQUS_SHORTNAME = 'npr-news'
        DEBUG = False
    elif deployment_target == 'staging':
        S3_BUCKETS = STAGING_S3_BUCKETS
        S3_BASE_URL = 'http://%s/%s' % (S3_BUCKETS[0]['bucket_name'], PROJECT_SLUG)
        SERVERS = STAGING_SERVERS
        SERVER_BASE_URL = 'http://%s/%s' % (SERVERS[0], PROJECT_SLUG)
        DISQUS_SHORTNAME = 'nprviz-test'
        DEBUG = True
    else:
        S3_BUCKETS = []
        S3_BASE_URL = 'http://127.0.0.1:8000'
        SERVERS = []
        SERVER_BASE_URL = 'http://127.0.0.1:8001/%s' % PROJECT_SLUG
        DISQUS_SHORTNAME = 'nprviz-test'
        DEBUG = True
        APP_LOG_PATH = '/tmp/%s.app.log' % PROJECT_SLUG

    DEPLOYMENT_TARGET = deployment_target

"""
Run automated configuration
"""
DEPLOYMENT_TARGET = os.environ.get('DEPLOYMENT_TARGET', None)

configure_targets(DEPLOYMENT_TARGET)
