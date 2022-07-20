#!/bin/bash
# Installs Berkeley DB 5.3. # @author Jack Peterson (jack@tinybike.net) # tampered with by bitsko for OpenBSD testing

set -e
trap "exit" INT

BLUE='\033[1;34m'
RED='\033[1;31m'
CYAN='\033[0;36m'
NC='\033[0m'

startdir=$(pwd)
bdb_dir="db5"
bdbtargz="db5.tar.gz"
bdbdlname="db-5.3.28.NC"
bdburl="http://download.oracle.com/berkeley-db/${bdbdlname}.tar.gz"
echo -e "\033[0;34mLogging to $startdir/log${NC}"
if [ -f "log" ]; then rm log; fi
if [ ! -d "$bdb_dir" ]; then
    mkdir -p "$bdb_dir"
    if [ ! -f "$startdir/$bdbtargz" ]; then
        echo -e "${RED}Downloading $bdburl...${NC}"
        wget -O $startdir/$bdbtargz $bdburl
    fi
    echo "****************************************************************"
    echo -e "${BLUE}Installing Berkeley DB 5.3 to $startdir/$bdb_dir...${NC}"
    mkdir -p "$bdb_dir"
    echo -e "${CYAN}  - unpack $bdbtargz -> ${PWD##*/}/${bdb_dir}${NC}"
    tar -zxvf "$bdbtargz" -s /${bdbdlname}/${bdb_dir}/ >>$startdir/log 2>&1
    cd "${startdir}"/"${bdb_dir}"
    # wget https://raw.githubusercontent.com/bitsko/bitcoin-related/main/bdb5_atomic_patch.sh
    # bash bdb5_atomic_patch.sh
    sed -i 's/#define	atomic_init(p, val)	((p)->value = (val))/#define	atomic_init_db(p, val)	((p)->value = (val))/g' src/dbinc/atomic.h
    sed -i 's/__atomic_compare_exchange((p), (o), (n))/__atomic_compare_exchange_db((p), (o), (n))/g' src/dbinc/atomic.h
    sed -i 's/static inline int __atomic_compare_exchange/static inline int __atomic_compare_exchange_db/g' src/dbinc/atomic.h
    sed -i 's/atomic_init(p, (newval)), 1)/atomic_init_db(p, (newval)), 1)/g' src/dbinc/atomic.h
    sed -i 's/atomic_init(&alloc_bhp->ref, 1);/atomic_init_db(&alloc_bhp->ref, 1);/g' src/mp/mp_fget.c
    sed -i 's/atomic_init(&frozen_bhp->ref, 0);/atomic_init_db(&frozen_bhp->ref, 0);/g' src/mp/mp_mvcc.c
    sed -i 's/atomic_init(&alloc_bhp->ref, 1);/atomic_init_db(&alloc_bhp->ref, 1);/g' src/mp/mp_mvcc.c
    sed -i 's/atomic_init(&htab[i].hash_page_dirty, 0);/atomic_init_db(&htab[i].hash_page_dirty, 0);/g' src/mp/mp_region.c
    sed -i 's/atomic_init(&hp->hash_page_dirty, 0);/atomic_init_db(&hp->hash_page_dirty, 0);/g' src/mp/mp_region.c
    sed -i 's/atomic_init(v, newval);/atomic_init_db(v, newval);/g' src/mutex/mut_method.c
    sed -i 's/atomic_init(&mutexp->sharecount, 0);/atomic_init_db(&mutexp->sharecount, 0);/g' src/mutex/mut_tas.c
    echo "***********************atomic patch applied************************"
    sleep 3
    cd "${startdir}"/"${bdb_dir}"/build_unix
    mkdir -p build
    export BDB_PREFIX=$(pwd)/build
    echo -e "${CYAN}  - dist/configure${NC}"
    ../dist/configure --disable-shared --disable-replication --enable-cxx --with-pic \
    --prefix="$BDB_PREFIX" CC=clang CXX=clang++ CPP=clang-cpp >>$startdir/log 2>&1
    # CC=gcc CXX=g++ CPP=cpp
    echo -e "${CYAN}  - install -> ${PWD##*/}/build${NC}"
    make install >>$startdir/log 2>&1
    cd ../..
    echo -e "${RED}Done.${NC}"
else
    export BDB_PREFIX=$(pwd)/"${bdb_dir}"/build_unix/build
    echo -e "${RED}Found local Berkeley DB: $BDB_PREFIX${NC}"
fi
cd "$startdir"
echo -e "${BLUE}Checking Berkeley DB version...${NC}"
eg++ version.cpp -I${BDB_PREFIX}/include/ -L${BDB_PREFIX}/lib/ -o version
./version
if [ -f "$startdir/../configure.ac" ] || [ -f "$startdir/../configure.in" ]; then
    cd "$startdir/.."
    echo -e "${BLUE}Creating configure script...${NC}"
    if [ ! -f "aclocal.m4" ]; then
        ./autogen.sh >>$startdir/log 2>&1
    fi
    autoreconf --install --force --prepend-include=${BDB_PREFIX}/include/ >>$startdir/log 2>&1
    echo -e "${BLUE}Configuring...${NC}"
    ./configure CPPFLAGS="-I${BDB_PREFIX}/include/" LDFLAGS="-L${BDB_PREFIX}/lib/" >>$startdir/log 2>&1
    cd "$startdir"
    echo -e "${RED}Done.${NC}"
fi
