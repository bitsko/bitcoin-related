# Pick some path to install boost to, here we create a directory within the dogecoin directory
BITCOIN_ROOT=$(pwd)
BOOST_PREFIX="${BITCOIN_ROOT}/boost"
mkdir -p $BOOST_PREFIX

# Fetch the source and verify that it is not tampered with
curl -o boost_1_61_0.tar.bz2 http://heanet.dl.sourceforge.net/project/boost/boost/1.61.0/boost_1_61_0.tar.bz2
echo 'a547bd06c2fd9a71ba1d169d9cf0339da7ebf4753849a8f7d6fdb8feee99b640  boost_1_61_0.tar.bz2' | sha256 -c
# MUST output: (SHA256) boost_1_61_0.tar.bz2: OK
tar -xjf boost_1_61_0.tar.bz2

# Boost 1.61 needs one small patch for OpenBSD
cd boost_1_61_0
# Also here: https://gist.githubusercontent.com/laanwj/bf359281dc319b8ff2e1/raw/92250de8404b97bb99d72ab898f4a8cb35ae1ea3/patch-boost_test_impl_execution_monitor_ipp.patch
patch -p0 < /usr/ports/devel/boost/patches/patch-boost_test_impl_execution_monitor_ipp

# Build w/ minimum configuration necessary for dogecoin
echo 'using gcc : : eg++ : <cxxflags>"-fvisibility=hidden -fPIC" <linkflags>"" <archiver>"ar" <striper>"strip"  <ranlib>"ranlib" <rc>"" : ;' > user-config.jam
config_opts="runtime-link=shared threadapi=pthread threading=multi link=static variant=release --layout=tagged --build-type=complete --user-config=user-config.jam -sNO_BZIP2=1"
./bootstrap.sh --without-icu --with-libraries=chrono,filesystem,program_options,system,thread,test
./b2 -d2 -j2 -d1 ${config_opts} --prefix=${BOOST_PREFIX} stage
./b2 -d0 -j4 ${config_opts} --prefix=${BOOST_PREFIX} install
