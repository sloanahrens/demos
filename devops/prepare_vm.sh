
# # install openjdk-7 
# sudo apt-get -y purge openjdk*
# sudo apt-get -y install openjdk-7-jdk

# # install curl
# sudo apt-get -y install curl


# wget https://download.elasticsearch.org/elasticsearch/elasticsearch/elasticsearch-1.3.4.tar.gz -O elasticsearch.tar.gz
# tar -xf elasticsearch.tar.gz
# rm elasticsearch.tar.gz
# sudo mv elasticsearch-* elasticsearch
# sudo mv elasticsearch /usr/local/share

# curl -L http://github.com/elasticsearch/elasticsearch-servicewrapper/tarball/master | tar -xz
# sudo mv *servicewrapper*/service /usr/local/share/elasticsearch/bin/
# rm -Rf *servicewrapper*
# sudo /usr/local/share/elasticsearch/bin/service/elasticsearch install
# sudo ln -s 'readlink -f /usr/local/share/elasticsearch/bin/service/elasticsearch' /usr/local/bin/rcelasticsearch
 
# sudo service elasticsearch start

# cd /usr/local/share/elasticsearch/
# ./bin/plugin -install royrusso/elasticsearch-HQ


# sudo add-apt-repository -y ppa:chris-lea/node.js
# sudo add-apt-repository -y ppa:webupd8team/sublime-text-3
# sudo apt-get -y update

sudo apt-get -y install software-properties-common
sudo apt-get -y install python-software-properties python g++ make
sudo apt-get -y install python-dev
sudo apt-get -y install gfortran libopenblas-dev liblapack-dev

sudo apt-get -y install nodejs
sudo apt-get -y install sublime-text-installer

sudo apt-get -y install python-setuptools
sudo easy_install pip


# sudo pip install virtualenv virtualenvwrapper
# sudo pip install elasticsearch
# # sudo pip install numpy
# # sudo pip install scipy

# sudo apt-get -y install git
# git clone https://github.com/sloanahrens/demos.git
# git checkout development
# git pull origin development

cd ~

sudo pip install virtualenv

virtualenv venv

source venv/bin/activate

cd demos

pip install -r requirements.txt
