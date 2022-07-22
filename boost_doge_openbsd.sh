# Pick some path to install boost to, here we create a directory within the dogecoin directory
BITCOIN_ROOT=$(pwd)
BOOST_PREFIX="${BITCOIN_ROOT}/boost"
mkdir -p $BOOST_PREFIX

# wget https://github.com/boostorg/boost/archive/refs/tags/boost-1.79.0.tar.gz
wget https://github.com/boostorg/boost/archive/refs/tags/boost-1.61.0.tar.gz
# tar -zxvf boost-1.79.0.tar.gz
tar -zxvf boost-1.61.0.tar.gz
# cd boost-boost-1.79.0
cd boost-boost-1.61.0

# Build w/ minimum configuration necessary for dogecoin
echo 'using gcc : : eg++ : <cxxflags>"-fvisibility=hidden -fPIC" <linkflags>"" <archiver>"ar" <striper>"strip"  <ranlib>"ranlib" <rc>"" : ;' > user-config.jam
config_opts="runtime-link=shared threadapi=pthread threading=multi link=static variant=release --layout=tagged --build-type=complete --user-config=user-config.jam -sNO_BZIP2=1"
./bootstrap.sh --without-icu --with-libraries=chrono,filesystem,program_options,system,thread,test
# --with-toolset=
./b2 -d2 -j2 -d1 ${config_opts} --prefix=${BOOST_PREFIX} stage
./b2 -d0 -j4 ${config_opts} --prefix=${BOOST_PREFIX} install
