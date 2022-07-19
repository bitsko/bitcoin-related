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
    echo -e "${BLUE}Installing Berkeley DB 5.3 to $startdir/$bdb_dir...${NC}"
    mkdir -p "$bdb_dir"
    echo -e "${CYAN}  - unpack $bdbtargz -> ${PWD##*/}/${bdb_dir}${NC}"
    tar -zxvf "$bdbtargz" -s /${bdbdlname}/${bdb_dir}/ >>$startdir/log 2>&1
    cd "${startdir}"/"${bdb_dir}"/build_unix
    mkdir -p build
    export BDB_PREFIX=$(pwd)/build
    echo -e "${CYAN}  - dist/configure${NC}"
    ../dist/configure --disable-shared --disable-replication --enable-cxx --with-pic \
    --prefix="$BDB_PREFIX" CC=egcc CXX=eg++ CPP=ecpp >>$startdir/log 2>&1
    echo -e "${CYAN}  - install -> ${PWD##*/}/build${NC}"
    make install >>$startdir/log 2>&1
    cd ../..
    echo -e "${RED}Done.${NC}"
else
    export BDB_PREFIX=$(pwd)/"${bdb_dir}"/build_unix/build
    echo -e "${RED}Found local Berkeley DB: $BDB_PREFIX${NC}"
fi
cd "$startdir"
# echo -e "${BLUE}Checking Berkeley DB version...${NC}"
# g++ version.cpp -I${BDB_PREFIX}/include/ -L${BDB_PREFIX}/lib/ -o version
# ./version
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
