
export NEW_PROJECT_SLUG=demos
cd local_code/$NEW_PROJECT_SLUG
. /home/sloan/.virtualenvs/$NEW_PROJECT_SLUG/bin/activate

export SERVERIP=54.148.221.131
ssh -i ~/.ssh/id_rsa.pub ubuntu@$SERVERIP



# set up local VM
# (after doing this: https://github.com/sloanahrens/qbox-blog-code/blob/master/ch_1_local_ubuntu_es/setup_new_vm.sh)

git clone git@github.com:sloanahrens/qbox-blog-code.git

export NEW_PROJECT_SLUG=demos
# if creating a new project, use the app-template:
# git clone git@github.com:sloanahrens/app-template.git $NEW_PROJECT_SLUG
git clone git@github.com:sloanahrens/demos.git

cd $NEW_PROJECT_SLUG

bash prepare_machine.sh


mkvirtualenv $NEW_PROJECT_SLUG
pip install -r requirements.txt
npm install

# if creating a new project from the app-template, you need to run fab bootstrap first:
# fab bootstrap
# otherwise, if you cloned the demos repo itself, run fab update
fab update

# python load_picker_data.py

python app.py

##############

# COPY_GOOGLE_DOC_URL = None

DEPLOY_TO_SERVERS = True
DEPLOY_SERVICES = True
STAGING_SERVERS = ['54.148.221.131']

fab staging master servers.prepare

fab staging master servers.install_es

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

fab staging master servers.setup

fab staging master servers.deploy_confs

fab staging master servers.fix_nginx

# [push local changes to git before deploying]

fab staging master deploy

# # needed to stash changes made on server:
# ssh -i ~/.ssh/id_rsa.pub ubuntu@$SERVERIP
# cd apps/demos/repository
# git add -A
# git stash


ssh -i ~/.ssh/id_rsa.pub ubuntu@$SERVERIP
cd apps/demos/; . virtualenv/bin/activate; cd repository/
python load_picker_data.py

# data.sloanahrens.com: ec2-54-69-153-155.us-west-2.compute.amazonaws.com


# internal server error, check uwsgi log
tail /var/log/demos.uwsgi.log


# find non-unicode characters in file:
grep --color='auto' -P -n "[\x80-\xFF]" file.xml