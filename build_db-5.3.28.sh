wget https://github.com/berkeleydb/libdb/releases/download/v5.3.28/db-5.3.28.tar.gz

tar -zxvf db-5.3.28.tar.gz

cd db-5.3.28/build_unix

../dist/configure

mkdir build

cd build

../make
