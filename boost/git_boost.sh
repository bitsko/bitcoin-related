git clone --recursive https://github.com/boostorg/boost.git
cd boost
git checkout tags/boost-1.61.0 -b master
# git checkout develop # or whatever branch you want to use
./bootstrap.sh
./b2 headers
