sed -i 's/#define	atomic_init(p, val)	((p)->value = (val))/#define	atomic_init_db(p, val)	((p)->value = (val))/g' /src/dbinc/atomic.h
sed -i 's/__atomic_compare_exchange((p), (o), (n))/__atomic_compare_exchange_db((p), (o), (n))/g' /src/dbinc/atomic.h
sed -i 's/static inline int __atomic_compare_exchange/static inline int __atomic_compare_exchange_db/g' /src/dbinc/atomic.h
sed -i 's/atomic_init(p, (newval)), 1)/atomic_init_db(p, (newval)), 1)/g' /src/dbinc/atomic.h
sed -i 's/atomic_init(&alloc_bhp->ref, 1);/atomic_init_db(&alloc_bhp->ref, 1);/g' /src/mp/mp_fget.c
sed -i 's/atomic_init(&frozen_bhp->ref, 0);/atomic_init_db(&frozen_bhp->ref, 0);/g' src/mp/mp_mvcc.c
sed -i 's/atomic_init(&alloc_bhp->ref, 1);/atomic_init_db(&alloc_bhp->ref, 1);/g' src/mp/mp_mvcc.c
sed -i 's/atomic_init(&htab[i].hash_page_dirty, 0);/atomic_init_db(&htab[i].hash_page_dirty, 0);/g' /src/mp/mp_region.c
sed -i 's/atomic_init(&hp->hash_page_dirty, 0);/atomic_init_db(&hp->hash_page_dirty, 0);/g' /src/mp/mp_region.c
sed -i 's/atomic_init(v, newval);/atomic_init_db(v, newval);/g' /src/mutex/mut_method.c
sed -i 's/atomic_init(&mutexp->sharecount, 0);/atomic_init_db(&mutexp->sharecount, 0);/g' /src/mutex/mut_tas.c
