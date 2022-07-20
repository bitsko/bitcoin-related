WORKING_DIR="$PWD"
DOWNLOADDIR="db5"
TAR_GZ_FILE="db5.tar.gz"
BDB_DL_NAME="db-5.3.28.NC"
BDB_DL_URL_="http://download.oracle.com/berkeley-db/${BDB_DL_NAME}.tar.gz"
BDB_BUILD_D="${WORKING_DIR}/${DOWNLOADDIR}/build_unix"
if [ ! -d "$DOWNLOADDIR" ]; then
    mkdir -p "$DOWNLOADDIR"
    if [ ! -f "$WORKING_DIR/$TAR_GZ_FILE" ]; then
        wget -O ${WORKING_DIR}/${TAR_GZ_FILE} $BDB_DL_URL_
    fi
    echo "****************************************************************"
    echo -e "Installing Berkeley DB 5.3 to $WORKING_DIR/$DOWNLOADDIR..."
    mkdir -p "$DOWNLOADDIR"
    echo -e "unpack $TAR_GZ_FILE -> ${PWD##*/}/${DOWNLOADDIR}"
    tar -zxvf "$TAR_GZ_FILE" -s /${BDB_DL_NAME}/${DOWNLOADDIR}/ 
    cd "${WORKING_DIR}"/"${DOWNLOADDIR}"
    # https://raw.githubusercontent.com/bitsko/bitcoin-related/main/bdb5_atomic_patch.sh
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
    cd "${BDB_BUILD_D}"
    mkdir -p build
    export BDB_PREFIX=${BDB_BUILD_D}/build
    echo -e "dist/configure"
    ../dist/configure --disable-shared --disable-replication --enable-cxx --with-pic \
    --prefix=$BDB_PREFIX CC=clang CXX=clang++ CPP=clang-cpp > $WORKING_DIR/config.log 2>&1
    # CC=gcc CXX=g++ CPP=cpp
    echo -e "install -> ${PWD##*/}/build"
    make install > $WORKING_DIR/install.log 2>&1
    cd ../..
    echo -e "Done.1"
else
    export BDB_PREFIX=${BDB_BUILD_D}/build
    echo -e "Found local Berkeley DB: $BDB_PREFIX"
fi
cd "$startdir"
echo -e "Checking Berkeley DB version..."
eg++ version.cpp -I${BDB_PREFIX}/include/ -L${BDB_PREFIX}/lib/ -o version
./version
if [ -f "$WORKING_DIR/../configure.ac" ] || [ -f "WORKING_DIR/../configure.in" ]; then
    cd "WORKING_DIR/.."
    echo -e "${BLUE}Creating configure script...${NC}"
    if [ ! -f "aclocal.m4" ]; then
        ./autogen.sh >>$WORKING_DIR/autogen.log 2>&1
    fi
    autoreconf --install --force --prepend-include=${BDB_PREFIX}/include/ >>$WORKING_DIR/autoreconf.log 2>&1
    echo -e "Configuring..."
    ./configure CPPFLAGS="-I${BDB_PREFIX}/include/" LDFLAGS="-L${BDB_PREFIX}/lib/" >>$WORKING_DIR/log 2>&1
    cd "$WORKING_DIR"
    echo -e "$Done.2"
fi
