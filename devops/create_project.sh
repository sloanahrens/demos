
# export NEW_PROJECT_SLUG=demos
# export SERVERIP=54.148.221.131
# ssh -i ~/.ssh/id_rsa.pub ubuntu@$SERVERIP


cd local_code

export NEW_PROJECT_SLUG=demos
git clone git@github.com:sloanahrens/app-template.git $NEW_PROJECT_SLUG
cd $NEW_PROJECT_SLUG

mkvirtualenv $NEW_PROJECT_SLUG
pip install -r requirements.txt
npm install

fab bootstrap

# . /home/sloan/.virtualenvs/$NEW_PROJECT_SLUG/bin/activate

DEPLOY_TO_SERVERS = True
DEPLOY_SERVICES = True
STAGING_SERVERS = ['54.148.221.131']


ssh -i ~/.ssh/id_rsa.pub ubuntu@$SERVERIP

nano ~/.bash_profile
# add these lines:
export PATH=/usr/local/bin:$PATH
export PATH=/usr/local/lib/python2.7/site-packages:$PATH
export NODE_PATH=/usr/local/lib/node_modules
source /usr/local/bin/virtualenvwrapper_lazy.sh
source /usr/local/bin/virtualenvwrapper.sh

export APPS_GOOGLE_EMAIL=<MY_APPS_GOOGLE_EMAIL>
export APPS_GOOGLE_PASS=<MY_APPS_GOOGLE_PASS>

export AWS_ACCESS_KEY_ID=<MY_AWS_ACCESS_KEY_ID>
export AWS_SECRET_ACCESS_KEY=<MY_AWS_SECRET_ACCESS_KEY>

nano ~/.bashrc
# add this line:
. ~/.bash_profile

exit

# push changes to git

fab staging master servers.prepare

fab staging master servers.install_es

fab staging master servers.setup

fab staging master servers.deploy_confs

fab staging master servers.fix_nginx